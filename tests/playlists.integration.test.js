// Integration test for playlists static and smart evaluation
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'meta_dj.test.playlists.sqlite');
const fixturesDir = path.join(__dirname, 'fixtures', 'audio');

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
fs.mkdirSync(fixturesDir, { recursive: true });
for (const name of ['track1.mp3', 'track2.flac']) {
    const p = path.join(fixturesDir, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}

execSync(`bash scripts/migrate-local.sh ${dbPath}`, { cwd: repoRoot, stdio: 'pipe' });
const env = { ...process.env, DJ_DB_PATH: dbPath };
execSync(`node packages/core/src/cli.js import ${fixturesDir}`, { cwd: repoRoot, stdio: 'pipe', env });
execSync(`node packages/core/src/cli.js analyze`, { cwd: repoRoot, stdio: 'pipe', env });

// Create static playlist and add one track
const outId = execSync(`node packages/core/src/cli.js playlist create 'My Crate'`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim();
const trackId = execSync(`sqlite3 ${dbPath} "SELECT id FROM tracks ORDER BY id LIMIT 1;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
execSync(`node packages/core/src/cli.js playlist add ${outId} ${trackId}`, { cwd: repoRoot, stdio: 'pipe', env });

// Verify tracks in playlist
const titles = execSync(`node packages/core/src/cli.js playlist tracks ${outId}`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim().split('\n');
assert.ok(titles.length >= 1 && titles[0], 'static playlist should list at least one track');

// Create a smart playlist by FTS and bpm range
const rules = JSON.stringify({ fts: 'track*', bpmMin: 60, bpmMax: 200 });
const smartId = execSync(`node packages/core/src/cli.js playlist create-smart 'Smart Crate' '${rules}'`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim();
const smartTitles = execSync(`node packages/core/src/cli.js playlist smart-eval ${smartId}`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim().split('\n');
assert.ok(smartTitles.length >= 1 && smartTitles[0], 'smart playlist evaluation should return matches');

console.log('playlists integration test passed');


