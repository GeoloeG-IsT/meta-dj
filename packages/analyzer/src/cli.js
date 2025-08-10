#!/usr/bin/env node
/* eslint-disable no-console */
const { analyzeFile } = require('./index');

async function main() {
    const [, , filePath] = process.argv;
    if (!filePath) {
        console.log('Usage: meta-dj-analyze <filePath>');
        process.exit(1);
    }
    const res = analyzeFile(filePath);
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});


