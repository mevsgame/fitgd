#!/bin/bash
# release.sh

# Read current version
CURRENT_VERSION=$(jq -r '.version' foundry/system.json)
echo "Current version: $CURRENT_VERSION"

# Check for argument or prompt for new version
if [ -n "$1" ]; then
  NEW_VERSION="$1"
else
  read -p "New version: " NEW_VERSION
fi

# Update system.json
jq ".version = \"$NEW_VERSION\"" foundry/system.json > tmp.json && mv tmp.json foundry/system.json

# Commit and tag
git add foundry/system.json
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Push both
git push origin main
git push origin "v$NEW_VERSION"

echo "Released v$NEW_VERSION"