---
description: Bump version and release. Defaults to minor (fraction) bump.
---

1. Run only on feature branch, never on main
2. Check the current version in `foundry/system.json`.
3. Determine the next version:
   - READ standard semver (Major.Minor.Patch) from `foundry/system.json`.
   - By default, increment the **Minor** version (the middle number, e.g., 0.20.0 -> 0.21.0) as requested by "fraction part".
   - CRITICAL: If the user requests a **Major** bump (e.g., 0.20.0 -> 1.0.0), you MUST ask for explicit confirmation before proceeding.
   - If the user requests a **Patch** bump (e.g., 0.20.0 -> 0.20.1), use that.
4. Commit if files are staged, merge into main
5. Run the release script with the new version:
   ```bash
   ./release.sh <NEW_VERSION>
   ```
6. Verify the git push was successful.