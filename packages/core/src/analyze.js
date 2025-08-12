/* eslint-disable no-console */
const { spawnSync } = require('child_process');

const { openDb, dbAll, dbRun, generateId } = require('./db');
const { analyzeFile: analyzeFileJs } = (() => {
    try { return require('../../analyzer/src/index'); } catch { return { analyzeFile: null }; }
})();

function getAnalyzer() {
    const mode = (process.env.DJ_ANALYZER || 'auto').toLowerCase();
    function rustAvailable() {
        const probe = spawnSync('meta-dj-analyzer-rs', ['--help'], { encoding: 'utf8' });
        return !(probe.error && probe.error.code === 'ENOENT');
    }
    function analyzeWithRust(filePath) {
        const res = spawnSync('meta-dj-analyzer-rs', [filePath], { encoding: 'utf8' });
        if (res.error) throw res.error;
        if (res.status !== 0) throw new Error(`rust analyzer exited ${res.status}: ${res.stderr || ''}`);
        return JSON.parse(res.stdout);
    }
    if (mode === 'rust') return (filePath) => analyzeWithRust(filePath);
    if (mode === 'js') {
        if (!analyzeFileJs) throw new Error('JS analyzer not available');
        return (filePath) => analyzeFileJs(filePath);
    }
    if (rustAvailable()) return (filePath) => analyzeWithRust(filePath);
    if (!analyzeFileJs) throw new Error('No analyzer available');
    return (filePath) => analyzeFileJs(filePath);
}

async function analyzeAllTracks() {
    const analyzer = getAnalyzer();
    const db = openDb();
    const files = await dbAll(db, 'SELECT id, file_path FROM tracks', []);
    for (const row of files) {
        let res;
        try { res = analyzer(row.file_path); } catch (e) { console.error('Analyze failed for', row.file_path, e); continue; }
        await dbRun(db,
            `INSERT INTO analysis (id, track_id, analyzer_version, bpm, bpm_confidence, musical_key, key_confidence, beatgrid_json, lufs, peak, waveform_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET analyzer_version=excluded.analyzer_version, bpm=excluded.bpm, bpm_confidence=excluded.bpm_confidence, musical_key=excluded.musical_key, key_confidence=excluded.key_confidence, beatgrid_json=excluded.beatgrid_json, lufs=excluded.lufs, peak=excluded.peak, waveform_ref=excluded.waveform_ref`,
            [
                generateId(row.id + (res.analyzer_version || res.analyzerVersion)),
                row.id,
                res.analyzer_version || res.analyzerVersion,
                res.bpm,
                res.bpm_confidence || res.bpmConfidence,
                res.musical_key || res.musicalKey,
                res.key_confidence || res.keyConfidence,
                res.beatgrid_json || res.beatgridJson,
                res.lufs,
                res.peak,
                res.waveform_ref || res.waveformRef,
            ]
        );
    }
    db.close();
    console.log(`Analyzed ${files.length} tracks.`);
}

module.exports = { analyzeAllTracks };


