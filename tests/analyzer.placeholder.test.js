// Basic tests for JS placeholder analyzer determinism
const assert = require('assert');
const path = require('path');
const { analyzeFile } = require('../packages/analyzer/src/index');

const f1 = path.join(__dirname, 'fixtures', 'audio', 'track1.mp3');
const f2 = path.join(__dirname, 'fixtures', 'audio', 'track2.flac');

const r1 = analyzeFile(f1);
const r1b = analyzeFile(f1);
assert.deepStrictEqual(r1, r1b, 'analyzer should be deterministic per file path');

const r2 = analyzeFile(f2);
assert.notDeepStrictEqual(r1, r2, 'different files should produce different results');

console.log('analyzer placeholder tests passed');


