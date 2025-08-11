// Integration: export Rekordbox XML from a static playlist
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'meta_dj.test.export.rb.sqlite');
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
const pid = execSync(`node packages/core/src/cli.js playlist create 'RB Crate'`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim();
const trackId = execSync(`sqlite3 ${dbPath} "SELECT id FROM tracks ORDER BY id LIMIT 1;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
execSync(`node packages/core/src/cli.js playlist add ${pid} ${trackId}`, { cwd: repoRoot, stdio: 'pipe', env });

const outFile = path.join(repoRoot, `.test-rb-${Date.now()}.xml`);
const outPath = execSync(`node packages/core/src/cli.js export rekordbox-xml ${pid} ${outFile}`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim();
assert.ok(outPath.endsWith('.xml'), 'should export .xml file');
assert.ok(fs.existsSync(outPath), 'exported RB XML exists');
const content = fs.readFileSync(outPath, 'utf8');
assert.ok(content.includes('<DJ_PLAYLISTS'), 'has DJ_PLAYLISTS root');
assert.ok(content.includes('<COLLECTION'), 'has collection');
assert.ok(content.includes('<PLAYLISTS'), 'has playlists');

console.log('rekordbox xml export integration test passed');


