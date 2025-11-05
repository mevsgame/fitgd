#!/bin/bash

# Download Clock SVG Assets from Blades in the Dark Foundry VTT
# Source: https://github.com/Dez384/foundryvtt-blades-in-the-dark (MIT License)

set -e

echo "=== Downloading Clock SVG Assets ==="
echo ""
echo "Source: Blades in the Dark Foundry VTT (MIT License)"
echo "Repository: https://github.com/Dez384/foundryvtt-blades-in-the-dark"
echo "Branch: master"
echo ""

# Create temp directory
TEMP_DIR="./temp_blades_download"
ASSETS_DIR="./public/assets/clocks/themes"

echo "1. Creating temp directory..."
mkdir -p "$TEMP_DIR"

echo "2. Cloning repository (sparse checkout - themes only)..."
cd "$TEMP_DIR"

# Initialize sparse checkout
git init
git remote add origin https://github.com/Dez384/foundryvtt-blades-in-the-dark.git
git config core.sparseCheckout true

# Only checkout themes directory
echo "themes/*" >> .git/info/sparse-checkout

echo "3. Fetching themes..."
git fetch --depth=1 origin master
git checkout master

echo "4. Copying clock assets..."
cd ..

# Create target directory
mkdir -p "$ASSETS_DIR"

# Copy needed themes
echo "   - Copying red theme (Physical Harm, Threats)..."
cp -r "$TEMP_DIR/themes/red" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: red theme not found"

echo "   - Copying grey theme (Morale Harm)..."
cp -r "$TEMP_DIR/themes/grey" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: grey theme not found"

echo "   - Copying blue theme (Progress clocks)..."
cp -r "$TEMP_DIR/themes/blue" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: blue theme not found"

echo "   - Copying yellow theme (Addiction clock)..."
cp -r "$TEMP_DIR/themes/yellow" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: yellow theme not found"

echo "   - Copying green theme (Consumable clocks)..."
cp -r "$TEMP_DIR/themes/green" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: green theme not found"

echo "   - Copying white theme (Personal goals)..."
cp -r "$TEMP_DIR/themes/white" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: white theme not found"

echo "   - Copying black theme (Faction clocks)..."
cp -r "$TEMP_DIR/themes/black" "$ASSETS_DIR/" 2>/dev/null || echo "     Warning: black theme not found"

echo "5. Cleaning up temp directory..."
rm -rf "$TEMP_DIR"

echo ""
echo "=== Download Complete! ==="
echo ""
echo "Clock assets installed to: $ASSETS_DIR"
echo ""
echo "Themes downloaded:"
ls -1 "$ASSETS_DIR" 2>/dev/null || echo "No themes found"
echo ""
echo "Attribution:"
echo "  These assets are from the Blades in the Dark Foundry VTT system"
echo "  by Dez384 and Megastruktur, used under MIT License."
echo "  See public/assets/clocks/README.md for full details."
echo ""
