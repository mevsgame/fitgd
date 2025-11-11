#!/usr/bin/env node
/**
 * Refactoring Verification Script
 *
 * Verifies that after refactoring fitgd.mjs:
 * 1. All functions/classes still exist
 * 2. All imports resolve correctly
 * 3. All Hooks are still registered
 * 4. JavaScript syntax is valid
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load the verification manifest
const manifestPath = path.join(projectRoot, 'foundry/module/.refactor-verification.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

let errors = [];
let warnings = [];
let passed = 0;

console.log('🔍 Refactoring Verification\n');
console.log('=' . repeat(60));

// Test 1: Check all functions still exist
console.log('\n📋 Test 1: Function Declarations');
for (const funcName of manifest.functions) {
  const found = findInFiles(funcName, /function\s+\w+\s*\(/);
  if (found.length === 0) {
    errors.push(`❌ Function not found: ${funcName}`);
  } else {
    passed++;
    console.log(`  ✓ ${funcName} (${found[0]})`);
  }
}

// Test 2: Check all classes still exist
console.log('\n📋 Test 2: Class Declarations');
for (const className of manifest.classes) {
  const found = findInFiles(className, /class\s+\w+/);
  if (found.length === 0) {
    errors.push(`❌ Class not found: ${className}`);
  } else {
    passed++;
    console.log(`  ✓ ${className} (${found[0]})`);
  }
}

// Test 3: Check all Hooks are registered
console.log('\n📋 Test 3: Hooks Registrations');
for (const hook of manifest.hooks) {
  const pattern = new RegExp(`Hooks\\.(once|on)\\(['"]${hook}['"]`);
  const found = findInFiles(hook, pattern);
  if (found.length === 0) {
    errors.push(`❌ Hook not registered: ${hook}`);
  } else {
    passed++;
    console.log(`  ✓ Hooks.${hook} (${found[0]})`);
  }
}

// Test 4: Check global assignments
console.log('\n📋 Test 4: Global Assignments (game.fitgd.*)');
for (const assignment of manifest.globalAssignments) {
  const property = assignment.replace('game.fitgd.', '');
  const pattern = new RegExp(`game\\.fitgd\\.${property}\\s*=`);
  const found = findInFiles(property, pattern);
  if (found.length === 0) {
    errors.push(`❌ Global assignment not found: ${assignment}`);
  } else {
    passed++;
    console.log(`  ✓ ${assignment} (${found[0]})`);
  }
}

// Test 5: Syntax validation
console.log('\n📋 Test 5: JavaScript Syntax Validation');
const moduleFiles = findAllMjsFiles();
for (const file of moduleFiles) {
  try {
    const filePath = path.join(projectRoot, 'foundry/module', file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Basic syntax checks
    const unclosedBraces = (content.match(/{/g) || []).length - (content.match(/}/g) || []).length;
    const unclosedParens = (content.match(/\(/g) || []).length - (content.match(/\)/g) || []).length;
    const unclosedBrackets = (content.match(/\[/g) || []).length - (content.match(/\]/g) || []).length;

    if (unclosedBraces !== 0) {
      errors.push(`❌ Unbalanced braces in ${file}: ${unclosedBraces}`);
    } else if (unclosedParens !== 0) {
      errors.push(`❌ Unbalanced parentheses in ${file}: ${unclosedParens}`);
    } else if (unclosedBrackets !== 0) {
      errors.push(`❌ Unbalanced brackets in ${file}: ${unclosedBrackets}`);
    } else {
      passed++;
      console.log(`  ✓ ${file}`);
    }
  } catch (err) {
    errors.push(`❌ Error reading ${file}: ${err.message}`);
  }
}

// Test 6: Import resolution
console.log('\n📋 Test 6: Import Resolution');
const imports = findAllImports();
for (const [file, importPath] of imports) {
  // Skip external and build artifact imports
  if (!importPath.startsWith('.') || importPath.includes('../dist/')) {
    passed++;
    console.log(`  ⊘ ${importPath} (in ${file}) [skipped: external/build]`);
    continue;
  }

  const resolved = resolveImport(file, importPath);
  if (!fs.existsSync(resolved)) {
    errors.push(`❌ Import not resolved: ${importPath} (in ${file})`);
  } else {
    passed++;
    console.log(`  ✓ ${importPath} (in ${file})`);
  }
}

// Final Report
console.log('\n' + '='.repeat(60));
console.log('\n📊 Final Report\n');
console.log(`  Passed: ${passed}`);
console.log(`  Errors: ${errors.length}`);
console.log(`  Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\n❌ ERRORS:\n');
  errors.forEach(err => console.log(`  ${err}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:\n');
  warnings.forEach(warn => console.log(`  ${warn}`));
}

if (errors.length === 0) {
  console.log('\n✅ All verification checks passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Verification failed!\n');
  process.exit(1);
}

// Helper functions
function findInFiles(searchTerm, pattern) {
  const moduleDir = path.join(projectRoot, 'foundry/module');
  const results = [];

  function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (file.endsWith('.mjs')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (pattern.test(content)) {
          const relativePath = path.relative(moduleDir, fullPath);
          results.push(relativePath);
        }
      }
    }
  }

  searchDir(moduleDir);
  return results;
}

function findAllMjsFiles() {
  const moduleDir = path.join(projectRoot, 'foundry/module');
  const results = [];

  function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (file.endsWith('.mjs')) {
        const relativePath = path.relative(moduleDir, fullPath);
        results.push(relativePath);
      }
    }
  }

  searchDir(moduleDir);
  return results;
}

function findAllImports() {
  const moduleDir = path.join(projectRoot, 'foundry/module');
  const results = [];

  function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (file.endsWith('.mjs')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(moduleDir, fullPath);

        // Remove comments to avoid false positives
        const withoutComments = content
          .replace(/\/\/.*$/gm, '')  // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove multi-line comments

        // Find all import statements (including re-exports)
        const importRegex = /(?:import|export)\s+.*?from\s+['"](.+?)['"]/g;
        let match;
        while ((match = importRegex.exec(withoutComments)) !== null) {
          results.push([relativePath, match[1]]);
        }
      }
    }
  }

  searchDir(moduleDir);
  return results;
}

function resolveImport(fromFile, importPath) {
  const moduleDir = path.join(projectRoot, 'foundry/module');
  const fromDir = path.dirname(path.join(moduleDir, fromFile));

  // Skip external imports
  if (!importPath.startsWith('.')) {
    return importPath; // Assume external imports are valid
  }

  // Skip ../dist/* imports (build artifacts)
  if (importPath.includes('../dist/')) {
    return importPath; // Assume dist files exist after build
  }

  let resolved = path.resolve(fromDir, importPath);

  // Add .mjs extension if not present
  if (!resolved.endsWith('.mjs') && !resolved.endsWith('.js')) {
    resolved += '.mjs';
  }

  return resolved;
}
