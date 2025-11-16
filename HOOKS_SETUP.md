# Git Hooks Setup

## Pre-commit Hook: Automatic Version Bumping

This project includes a pre-commit hook that **automatically bumps the minor version** when you commit changes on the `main` branch.

### How It Works

**When you commit on `main` branch:**
1. Hook checks if `src/` or `foundry/module/` files changed
2. If yes, it bumps the version from `X.Y.Z` → `X.(Y+1).0`
3. Updates both `package.json` and `foundry/system.json`
4. Stages the version changes
5. Amends your commit to include them

**It does NOT bump if:**
- You're on a different branch (e.g., feature branches)
- You manually changed the version files yourself
- Only config/docs changed (no src/ or foundry/module/ changes)

### Manual Version Control

If you want to manually control the version, just edit the version in the commit:

```bash
# Before committing, manually update version
# Edit package.json and foundry/system.json with desired version

# Now commit
git add .
git commit -m "your message"

# Hook will detect you changed the version and skip auto-bumping
```

### Bypass the Hook

If you need to bypass the hook for some reason:

```bash
git commit --no-verify -m "your message"
```

### Installation Status

✅ **Hook is installed and active**

The hook uses:
- `.husky/pre-commit` - Shell script that runs the checks
- `.husky/bump-version.cjs` - Node.js script that bumps versions

### Requirements

- husky (already in devDependencies)
- Node.js 18+ (already required by the project)

### Testing the Hook

To see what the hook would do without actually committing:

```bash
node .husky/bump-version.cjs
```

This will show the version bump that would happen (but won't actually amend anything in a test context).

### Troubleshooting

**"Hook failed to run"**
- Make sure you ran `pnpm install`
- Husky needs to be initialized: `pnpm exec husky install`

**"Version didn't bump"**
- Check if you're on the `main` branch: `git rev-parse --abbrev-ref HEAD`
- Check if your changes include src/ or foundry/module/ files
- Check if you manually edited the version files (hook skips if you did)

**"I want to disable the hook temporarily"**
```bash
git commit --no-verify
```

### For Team Members

Just commit normally! The hook runs automatically and handles version bumping. You don't need to manually manage version numbers.

### Release Workflow

After committing with auto-bumped versions:

```bash
# 1. Push to main (includes auto-bumped versions)
git push origin main

# 2. Create release tag
git tag v0.2.0
git push origin v0.2.0

# 3. GitHub Actions builds and releases automatically
```

The versions are already up-to-date in your commits, so they'll match your release tags.
