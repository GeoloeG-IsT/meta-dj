// Integration: export M3U8 from a static playlist
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'meta_dj.test.export.sqlite');
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
const pid = execSync(`node packages/core/src/cli.js playlist create 'Export Crate'`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim();
const trackId = execSync(`sqlite3 ${dbPath} "SELECT id FROM tracks ORDER BY id LIMIT 1;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
execSync(`node packages/core/src/cli.js playlist add ${pid} ${trackId}`, { cwd: repoRoot, stdio: 'pipe', env });

const outDir = path.join(repoRoot, `.test-export-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });
const outPath = execSync(`node packages/core/src/cli.js export m3u ${pid} ${outDir}`, { cwd: repoRoot, stdio: 'pipe', env }).toString().trim();
assert.ok(outPath.endsWith('.m3u8'), 'should export .m3u8 file');
assert.ok(fs.existsSync(outPath), 'exported file exists');
const content = fs.readFileSync(outPath, 'utf8');
assert.ok(content.includes('#EXTM3U'), 'has header');

console.log('export m3u integration test passed');


