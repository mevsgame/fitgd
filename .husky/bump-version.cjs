#!/usr/bin/env node

/**
 * Pre-commit hook: Auto-bump minor version
 * Runs on main branch if src/ or foundry/module/ files changed
 * Unless the user explicitly updated the version files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');

/**
 * Bump version from X.Y.Z to X.(Y+1).0
 * Handles pre-release versions like 1.0.0-beta
 */
function bumpMinorVersion(version) {
  // Remove pre-release suffix if present
  const basePart = version.split('-')[0];
  const [major, minor, patch] = basePart.split('.').map(Number);

  return `${major}.${minor + 1}.0`;
}

/**
 * Update version in a JSON file
 */
function updateVersionInFile(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /"version":\s*"[^"]*"/,
    `"version": "${newVersion}"`
  );
  fs.writeFileSync(filePath, updated, 'utf8');
}

try {
  // Read current version from package.json
  const packagePath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;
  const newVersion = bumpMinorVersion(currentVersion);

  console.log(`📦 Auto-bumping version from ${currentVersion} to ${newVersion} on main branch`);

  // Update package.json
  updateVersionInFile(packagePath, newVersion);

  // Update foundry/system.json
  const systemPath = path.join(projectRoot, 'foundry/system.json');
  updateVersionInFile(systemPath, newVersion);

  // Stage the updated files
  execSync(`git add "${packagePath}" "${systemPath}"`, { cwd: projectRoot });

  // Amend the commit to include version bump
  execSync('git commit --amend --no-edit --quiet', { cwd: projectRoot });

  console.log('✓ Version bumped and staged automatically');
} catch (error) {
  console.error('✗ Failed to bump version:', error.message);
  process.exit(1);
}
