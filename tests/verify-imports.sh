#!/bin/bash

echo "Verifying test infrastructure imports..."
echo

# Check for @/ alias imports (should use relative paths instead)
echo "Checking for problematic @/ imports:"
ALIAS_COUNT=$(grep -r "from ['\"]@/" tests/mocks tests/integration 2>/dev/null | wc -l)

if [ "$ALIAS_COUNT" -gt 0 ]; then
  echo "  ✗ Found $ALIAS_COUNT @/ alias imports (should use relative paths)"
  grep -rn "from ['\"]@/" tests/mocks tests/integration
  exit 1
else
  echo "  ✓ No @/ alias imports found - all using relative paths"
fi

echo
echo "Checking source file references exist:"
for file in src/store.ts src/types/character.ts src/types/crew.ts src/types/clock.ts src/types/playerRoundState.ts src/slices/characterSlice.ts src/slices/crewSlice.ts src/slices/clockSlice.ts src/slices/playerRoundStateSlice.ts; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file - NOT FOUND"
    exit 1
  fi
done

echo
echo "✅ All import paths verified successfully!"
echo
echo "To run the tests:"
echo "  1. Install dependencies: npm install"
echo "  2. Run tests: npm test tests/integration/playerActionWidget.example.test.ts"
