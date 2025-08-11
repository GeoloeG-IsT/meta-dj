// Validate Rust analyzer binary output and artifact writing if available in PATH
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const bin = 'meta-dj-analyzer-rs';
const which = spawnSync('bash', ['-lc', `command -v ${bin}`], { encoding: 'utf8' });
if (which.status !== 0) {
    console.log('Rust analyzer not installed; skipping');
    process.exit(0);
}

const artifactsDir = path.join(process.cwd(), `.test-artifacts-${Date.now()}`);
fs.mkdirSync(artifactsDir, { recursive: true });
const res = spawnSync(bin, ['tests/fixtures/audio/track1.mp3'], {
    encoding: 'utf8',
    env: { ...process.env, META_DJ_ARTIFACTS_DIR: artifactsDir },
});
if (res.status !== 0) {
    console.error('Analyzer exited non-zero', res.stderr);
    process.exit(1);
}
let obj;
try {
    obj = JSON.parse(res.stdout);
} catch (e) {
    console.error('Invalid JSON', e, res.stdout);
    process.exit(1);
}

if (typeof obj.bpm !== 'number' || typeof obj.lufs !== 'number') {
    console.error('Missing numeric fields');
    process.exit(1);
}

if (obj.waveform_ref) {
    if (!fs.existsSync(obj.waveform_ref)) {
        console.error('waveform_ref file missing:', obj.waveform_ref);
        process.exit(1);
    }
}

console.log('rust analyzer binary test passed');


