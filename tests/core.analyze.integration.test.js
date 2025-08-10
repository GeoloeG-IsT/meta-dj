// Integration test: import fixtures, run analyze, verify rows in SQLite
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'meta_dj.local.sqlite');
const fixturesDir = path.join(__dirname, 'fixtures', 'audio');

// Ensure fresh DB
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

// Ensure fixtures exist
fs.mkdirSync(fixturesDir, { recursive: true });
for (const name of ['track1.mp3', 'track2.flac']) {
    const p = path.join(fixturesDir, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
}

// Run migration
execSync(`bash scripts/migrate-local.sh ${dbPath}`, { cwd: repoRoot, stdio: 'pipe' });

// Import and analyze
execSync(`node packages/core/src/cli.js import ${fixturesDir}`, { cwd: repoRoot, stdio: 'pipe' });
execSync(`node packages/core/src/cli.js analyze`, { cwd: repoRoot, stdio: 'pipe' });

// Query analysis count
const out = execSync(`sqlite3 ${dbPath} "SELECT COUNT(*) FROM analysis;"`, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
assert.strictEqual(out, '2', 'analysis rows should be 2');

console.log('core analyze integration test passed');


