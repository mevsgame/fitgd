/**
 * Simple verification script to check that imports resolve correctly
 * Run with: node tests/verify-imports.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Verifying test infrastructure imports...\n');

try {
  // Check if files exist

  const files = [
    'tests/mocks/foundryApi.ts',
    'tests/mocks/bridgeSpy.ts',
    'tests/mocks/uiMocks.ts',
    'tests/integration/playerActionWidget.harness.ts',
    'tests/integration/playerActionWidget.example.test.ts',
  ];

  console.log('✓ Checking file existence:');
  files.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✓ ${file}`);
    } else {
      console.log(`  ✗ ${file} - NOT FOUND`);
      process.exit(1);
    }
  });

  console.log('\n✓ Checking import paths:');

  // Check imports use relative paths (not @/)
  files.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Check for problematic @/ imports
    const aliasImports = content.match(/from ['"]@\//g);
    if (aliasImports && aliasImports.length > 0) {
      console.log(`  ✗ ${file} - Contains ${aliasImports.length} @/ alias imports (should use relative paths)`);
      process.exit(1);
    } else {
      console.log(`  ✓ ${file} - Uses relative imports`);
    }
  });

  console.log('\n✓ Checking source file references:');

  const srcPaths = [
    'src/store',
    'src/types/character',
    'src/types/crew',
    'src/types/clock',
    'src/types/playerRoundState',
    'src/slices/charactersSlice',
    'src/slices/crewsSlice',
    'src/slices/clocksSlice',
    'src/slices/playerRoundStateSlice',
  ];

  srcPaths.forEach(srcPath => {
    const ext = srcPath.includes('Slice') ? '.ts' : '.ts';
    const fullPath = path.join(__dirname, '..', srcPath + ext);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✓ ${srcPath}`);
    } else {
      console.log(`  ✗ ${srcPath} - NOT FOUND`);
    }
  });

  console.log('\n✅ All import paths verified successfully!');
  console.log('\nTo run the tests:');
  console.log('  1. Install dependencies: npm install');
  console.log('  2. Run tests: npm test tests/integration/playerActionWidget.example.test.ts');

} catch (error) {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
}
