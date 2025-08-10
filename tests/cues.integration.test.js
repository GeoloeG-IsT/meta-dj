// Integration test for autocue and cue/loop editor CLI
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'meta_dj.local.sqlite');
const fixturesDir = path.join(__dirname, 'fixtures', 'audio');

// Fresh DB
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
fs.mkdirSync(fixturesDir, { recursive: true });
for (const name of ['track1.mp3', 'track2.flac']) {
    const p = path.join(fixturesDir, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}

// Migration, import, analyze, autocue
execSync(`bash scripts/migrate-local.sh ${dbPath}`, { cwd: repoRoot, stdio: 'pipe' });
execSync(`node packages/core/src/cli.js import ${fixturesDir}`, { cwd: repoRoot, stdio: 'pipe' });
execSync(`node packages/core/src/cli.js analyze`, { cwd: repoRoot, stdio: 'pipe' });
execSync(`node packages/core/src/cli.js autocue`, { cwd: repoRoot, stdio: 'pipe' });

// Counts
const cuesCount = execSync(`sqlite3 ${dbPath} "SELECT COUNT(*) FROM cues;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
const loopsCount = execSync(`sqlite3 ${dbPath} "SELECT COUNT(*) FROM loops;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
assert.strictEqual(cuesCount, '4', 'autocue should create 2 cues per track');
assert.strictEqual(loopsCount, '2', 'autocue should create 1 loop per track');

// Editor ops: add one manual cue and loop to first track
const trackId = execSync(`sqlite3 ${dbPath} "SELECT id FROM tracks ORDER BY id LIMIT 1;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
execSync(`node packages/core/src/cli.js cue add ${trackId} 12345 'Test Cue' red HOT`, { cwd: repoRoot, stdio: 'pipe' });
execSync(`node packages/core/src/cli.js loop add ${trackId} 64000 16 'Test Loop' blue`, { cwd: repoRoot, stdio: 'pipe' });

const cuesAfter = execSync(`sqlite3 ${dbPath} "SELECT COUNT(*) FROM cues WHERE track_id='${trackId}';"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
const loopsAfter = execSync(`sqlite3 ${dbPath} "SELECT COUNT(*) FROM loops WHERE track_id='${trackId}';"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
assert.strictEqual(cuesAfter, '3', 'track should have 3 cues after manual add');
assert.strictEqual(loopsAfter, '2', 'track should have 2 loops after manual add');

console.log('cues/loops integration test passed');


