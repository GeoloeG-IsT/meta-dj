// Integration: core analyze with Rust binary and artifact emission
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'meta_dj.test.rs.sqlite');
const fixturesDir = path.join(__dirname, 'fixtures', 'audio');
const which = spawnSync('bash', ['-lc', 'command -v meta-dj-analyzer-rs'], { encoding: 'utf8' });
if (which.status !== 0) {
    console.log('Rust analyzer not installed; skipping');
    process.exit(0);
}

// Fresh DB & fixtures
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
fs.mkdirSync(fixturesDir, { recursive: true });
for (const name of ['track1.mp3']) {
    const p = path.join(fixturesDir, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}

// Artifact dir
const artifactsDir = path.join(repoRoot, `.test-artifacts-core-${Date.now()}`);
fs.mkdirSync(artifactsDir, { recursive: true });

// Migrate, import, analyze (Rust), with artifacts
execSync(`bash scripts/migrate-local.sh ${dbPath}`, { cwd: repoRoot, stdio: 'pipe' });
const env = { ...process.env, DJ_DB_PATH: dbPath, DJ_ANALYZER: 'rust', META_DJ_ARTIFACTS_DIR: artifactsDir };
execSync(`node packages/core/src/cli.js import ${fixturesDir}`, { cwd: repoRoot, stdio: 'pipe', env });
execSync(`node packages/core/src/cli.js analyze`, { cwd: repoRoot, stdio: 'pipe', env });

// Verify analysis rows and waveform_ref if written
const rows = execSync(`sqlite3 ${dbPath} "SELECT analyzer_version, waveform_ref FROM analysis;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim().split('\n');
assert.ok(rows.length >= 1, 'analysis rows should exist');
const first = rows[0].split('|');
assert.ok(first[0].includes('rs-placeholder'), 'analyzer_version should be from rust');
if (first[1]) {
    assert.ok(fs.existsSync(first[1]), 'waveform_ref should point to an existing file');
}

console.log('core + rust analyzer integration test passed');


