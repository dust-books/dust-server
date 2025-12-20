#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get version from command line argument
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Error: Version argument required');
  process.exit(1);
}

// Read build.zig.zon
const zigZonPath = path.join(__dirname, '..', 'build.zig.zon');
let content = fs.readFileSync(zigZonPath, 'utf8');

// Update version field
content = content.replace(
  /\.version = ".*?"/,
  `.version = "${newVersion}"`
);

// Write back
fs.writeFileSync(zigZonPath, content, 'utf8');

console.log(`Updated build.zig.zon version to ${newVersion}`);
