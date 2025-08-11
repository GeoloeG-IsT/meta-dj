use serde::Serialize;
use std::env;
use anyhow::Result;
use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Analysis {
    analyzer_version: String,
    bpm: f32,
    bpm_confidence: f32,
    musical_key: String,
    key_confidence: f32,
    beatgrid_json: String,
    lufs: f32,
    peak: f32,
    waveform_ref: Option<String>,
}

fn pseudo_from(input: &str) -> u32 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    input.hash(&mut hasher);
    (hasher.finish() & 0xFFFF_FFFF) as u32
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: meta-dj-analyzer-rs <filePath>");
        std::process::exit(1);
    }
    let path = &args[1];
    // Ensure artifacts directory exists if configured
    let artifacts_dir_opt = std::env::var("META_DJ_ARTIFACTS_DIR").ok();
    if let Some(dir) = &artifacts_dir_opt { let _ = std::fs::create_dir_all(dir); }

    // Try to open and decode briefly to validate and derive basic properties
    if let Ok(file) = std::fs::File::open(path) {
        let mss = MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = Hint::new();
        if let Some(ext) = std::path::Path::new(path).extension().and_then(|s| s.to_str()) { hint.with_extension(ext); }
        let probed = symphonia::default::get_probe().format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default());
        if let Ok(mut probed) = probed {
            if let Some(track) = probed.format.default_track() {
                let track_id = track.id;
                let codec_params = track.codec_params.clone();
                if let Ok(mut decoder) = symphonia::default::get_codecs().make(&codec_params, &DecoderOptions::default()) {
                    let mut total_frames: usize = 0;
                    let max_frames: usize = 44_100 * 30; // ~30s cap to limit workload
                    let mut sum_sq: f64 = 0.0;
                    let mut peak_abs: f32 = 0.0;
                    // Simple waveform envelope: RMS per window over downmixed mono
                    let mut waveform_values: Vec<f32> = Vec::new();
                    let window: usize = 1024;
                    let mut acc_sq: f64 = 0.0;
                    let mut acc_n: usize = 0;
                    while total_frames < max_frames {
                        let packet = match probed.format.next_packet() { Ok(p) => p, Err(_) => break };
                        if packet.track_id() != track_id { continue; }
                        let decoded = match decoder.decode(&packet) { Ok(d) => d, Err(_) => continue };
                        match decoded {
                            AudioBufferRef::F32(buf) => {
                                let ch = buf.spec().channels.count().max(1);
                                let frames = buf.frames();
                                for i in 0..frames {
                                    let mut mono = 0.0f32;
                                    for c in 0..ch { mono += buf.chan(c)[i]; }
                                    mono /= ch as f32;
                                    let a = mono.abs(); if a > peak_abs { peak_abs = a; }
                                    let v = mono as f64;
                                    sum_sq += v * v;
                                    acc_sq += v * v;
                                    acc_n += 1;
                                    if acc_n == window {
                                        waveform_values.push((acc_sq / (window as f64)).sqrt() as f32);
                                        acc_sq = 0.0; acc_n = 0;
                                    }
                                }
                                total_frames += frames;
                            }
                            AudioBufferRef::S16(buf) => {
                                let ch = buf.spec().channels.count().max(1);
                                let frames = buf.frames();
                                for i in 0..frames {
                                    let mut mono = 0.0f32;
                                    for c in 0..ch { mono += (buf.chan(c)[i] as f32) / 32768.0; }
                                    mono /= ch as f32;
                                    let a = mono.abs(); if a > peak_abs { peak_abs = a; }
                                    let v = mono as f64;
                                    sum_sq += v * v;
                                    acc_sq += v * v;
                                    acc_n += 1;
                                    if acc_n == window {
                                        waveform_values.push((acc_sq / (window as f64)).sqrt() as f32);
                                        acc_sq = 0.0; acc_n = 0;
                                    }
                                }
                                total_frames += frames;
                            }
                            AudioBufferRef::S32(buf) => {
                                let ch = buf.spec().channels.count().max(1);
                                let frames = buf.frames();
                                for i in 0..frames {
                                    let mut mono = 0.0f32;
                                    for c in 0..ch { mono += (buf.chan(c)[i] as f32) / 2147483648.0; }
                                    mono /= ch as f32;
                                    let a = mono.abs(); if a > peak_abs { peak_abs = a; }
                                    let v = mono as f64;
                                    sum_sq += v * v;
                                    acc_sq += v * v;
                                    acc_n += 1;
                                    if acc_n == window {
                                        waveform_values.push((acc_sq / (window as f64)).sqrt() as f32);
                                        acc_sq = 0.0; acc_n = 0;
                                    }
                                }
                                total_frames += frames;
                            }
                            AudioBufferRef::U8(buf) => {
                                let ch = buf.spec().channels.count().max(1);
                                let frames = buf.frames();
                                for i in 0..frames {
                                    let mut mono = 0.0f32;
                                    for c in 0..ch { mono += ((buf.chan(c)[i] as f32) - 128.0) / 128.0; }
                                    mono /= ch as f32;
                                    let a = mono.abs(); if a > peak_abs { peak_abs = a; }
                                    let v = mono as f64;
                                    sum_sq += v * v;
                                    acc_sq += v * v;
                                    acc_n += 1;
                                    if acc_n == window {
                                        waveform_values.push((acc_sq / (window as f64)).sqrt() as f32);
                                        acc_sq = 0.0; acc_n = 0;
                                    }
                                }
                                total_frames += frames;
                            }
                            _ => {
                                // Unsupported sample format for quick pass; skip.
                            }
                        }
                    }
                    if total_frames > 0 {
                        let mean_square = sum_sq / (total_frames as f64);
                        // Simple LUFS approximation from mean square; not EBU R128-compliant
                        let lufs_est = -0.691 + 10.0 * (mean_square.max(1e-12)).log10();
                        // Overwrite placeholder below
                        // We propagate via variables outside the block using shadowing below.
                        // For simplicity, we set environment markers to read later if needed.
                        std::env::set_var("META_DJ_LUFS_EST", format!("{}", lufs_est));
                        std::env::set_var("META_DJ_PEAK_EST", format!("{}", peak_abs));
                        // Write waveform artifact
                        if !waveform_values.is_empty() {
                            let dir = artifacts_dir_opt.clone().unwrap_or_else(|| ".meta-dj-artifacts".to_string());
                            let _ = std::fs::create_dir_all(&dir);
                            use std::io::Write;
                            // Derive id from path
                            let mut hasher = sha1_smol::Sha1::new();
                            hasher.update(path.as_bytes());
                            let id = hex::encode(hasher.digest().bytes());
                            let out_path = format!("{}/{}.waveform.json", dir, id);
                            let payload = serde_json::json!({
                                "window": window,
                                "values": waveform_values,
                            });
                            if let Ok(mut f) = std::fs::File::create(&out_path) {
                                let _ = f.write_all(serde_json::to_string(&payload).unwrap().as_bytes());
                                std::env::set_var("META_DJ_WAVEFORM_REF", out_path);
                            }
                        }
                    }
                }
            }
        }
    }

    let seed = pseudo_from(path);
    let bpm = 60.0 + (seed % 121) as f32; // 60..180
    let bpm_conf = 0.5 + ((seed >> 3) % 50) as f32 / 100.0;
    let keys = ["C","G","D","A","E","B","F#","C#","F","Bb","Eb","Ab","Db","Gb","Cb"]; 
    let modes = ["maj","min"]; 
    let musical_key = format!("{} {}", keys[(seed as usize) % keys.len()], modes[((seed >> 2) as usize) % 2]);
    let key_conf = 0.5 + ((seed >> 5) % 50) as f32 / 100.0;
    let lufs = if let Ok(val) = std::env::var("META_DJ_LUFS_EST") { val.parse::<f32>().unwrap_or(-14.0) } else { -14.0 - ((seed >> 7) % 8) as f32 };
    let peak = if let Ok(val) = std::env::var("META_DJ_PEAK_EST") { val.parse::<f32>().unwrap_or(0.9) } else { 0.5 + ((seed >> 9) % 50) as f32 / 100.0 };
    let beatgrid = serde_json::json!({
        "bpm": bpm,
        "markers": [{"positionMs": 0, "confidence": bpm_conf, "downbeat": true}]
    });
    let res = Analysis {
        analyzer_version: "rs-placeholder-0.0.1".to_string(),
        bpm,
        bpm_confidence: bpm_conf,
        musical_key: musical_key,
        key_confidence: key_conf,
        beatgrid_json: beatgrid.to_string(),
        lufs,
        peak,
        waveform_ref: std::env::var("META_DJ_WAVEFORM_REF").ok(),
    };
    println!("{}", serde_json::to_string_pretty(&res).unwrap());
    Ok(())
}


