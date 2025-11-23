/**
 * Script to find and replace old 12-action system with new 4-approach system in test files
 * 
 * Old system (12 actions, 12 total dots):
 * shoot, command, skirmish, skulk, wreck, finesse, survey, study, tech, attune, consort, sway
 * 
 * New system (4 approaches, 5 total dots, max 2 per approach at creation):
 * force, guile, focus, spirit
 * 
 * Common old pattern (12 dots total):
 * shoot: 2, command: 2, skirmish: 2, skulk: 2,
 * wreck: 1, finesse: 1, survey: 1, study: 1,
 * tech: 0, attune: 0, consort: 0, sway: 0
 * 
 * New pattern (5 dots total):
 * force: 2, guile: 1, focus: 1, spirit: 1
 */

import * as fs from 'fs';
import * as path from 'path';

const testsDir = 'd:\\GitHub\\fitgd\\tests';

// Replacement mapping
const replacements = [
    // Replace old 12-action approach objects with new 4-approach objects
    {
        pattern: /approaches:\s*\{\s*shoot:\s*2,\s*command:\s*2,\s*skirmish:\s*2,\s*skulk:\s*2,\s*wreck:\s*1,\s*finesse:\s*1,\s*survey:\s*1,\s*study:\s*1,\s*tech:\s*0,\s*attune:\s*0,\s*consort:\s*0,\s*sway:\s*0\s*\}/g,
        replacement: 'approaches: { force: 2, guile: 1, focus: 1, spirit: 1 }'
    },
    {
        pattern: /approaches:\s*\{\s*shoot:\s*3,\s*command:\s*2,\s*skirmish:\s*2,\s*skulk:\s*1,\s*wreck:\s*1,\s*finesse:\s*1,\s*survey:\s*1,\s*study:\s*1,\s*tech:\s*0,\s*attune:\s*0,\s*consort:\s*0,\s*sway:\s*0\s*\}/g,
        replacement: 'approaches: { force: 2, guile: 2, focus: 1, spirit: 0 }'
    },
    {
        pattern: /approaches:\s*\{\s*shoot:\s*1,\s*command:\s*1,\s*skirmish:\s*1,\s*skulk:\s*1,\s*wreck:\s*2,\s*finesse:\s*2,\s*survey:\s*2,\s*study:\s*1,\s*tech:\s*0,\s*attune:\s*0,\s*consort:\s*0,\s*sway:\s*0\s*\}/g,
        replacement: 'approaches: { force: 1, guile: 1, focus: 2, spirit: 1 }'
    }
];

function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const { pattern, replacement } of replacements) {
        if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function walkDir(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.test.ts')) {
            processFile(filePath);
        }
    }
}

console.log('Starting migration from 12-action to 4-approach system...');
walkDir(testsDir);
console.log('Migration complete!');
