# Development Guide

This guide covers setting up a live development environment for FitGD with Foundry VTT.

## Prerequisites

- Node.js 18+ and npm/pnpm
- Foundry VTT installed
- Basic terminal/command line knowledge

## Development Setup

### 1. Install Dependencies

```bash
cd /home/user/fitgd
npm install  # or pnpm install
```

### 2. Create Symlink to Foundry Systems Folder

Instead of copying files, create a symbolic link so changes are reflected immediately:

**Linux/Mac:**
```bash
# Find your Foundry data path
# Usually: ~/.local/share/FoundryVTT/Data/systems/ (Linux)
# Or: ~/Library/Application Support/FoundryVTT/Data/systems/ (Mac)

# Create symlink
ln -s /home/user/fitgd/foundry /path/to/FoundryVTT/Data/systems/forged-in-the-grimdark
```

**Windows (run as Administrator):**
```cmd
mklink /D "C:\Users\YourName\AppData\Local\FoundryVTT\Data\systems\forged-in-the-grimdark" "C:\path\to\fitgd\foundry"
```

### 3. Build Once to Create Initial Dist

```bash
npm run build
```

This creates `foundry/dist/fitgd-core.es.js` and `foundry/dist/fitgd-core.umd.js`.

### 4. Start Watch Mode

In your terminal, run:

```bash
npm run dev
```

This starts Vite in watch mode. Any changes to `src/**/*.ts` will automatically rebuild the library to `foundry/dist/`.

**Leave this running** while you develop!

## Development Workflow

### Typical Development Session

```bash
# Terminal 1: Watch mode for automatic rebuilds
npm run dev

# Terminal 2: Run tests in watch mode (optional)
npm test

# Terminal 3: Optional - TypeDoc watch for documentation
npm run docs:watch
```

### Making Changes

1. **Edit source files** in `src/` or `foundry/`
2. Vite **automatically rebuilds** to `foundry/dist/`
3. In Foundry VTT, **refresh the page** (F5) to see changes
4. Test your changes in Foundry

### Quick Iteration Cycle

```
Edit code → Save → Refresh Foundry (F5) → Test
```

**No manual build step needed!** Watch mode handles it.

## Project Structure

```
fitgd/
├── src/                      # Core library (TypeScript + Redux)
│   ├── api/                  # Public API
│   ├── slices/               # Redux slices
│   ├── selectors/            # Memoized selectors
│   ├── validators/           # Business logic validation
│   └── types/                # TypeScript types
│
├── foundry/                  # Foundry VTT system (symlinked to Foundry)
│   ├── system.json           # Foundry manifest
│   ├── template.json         # Actor/Item data models
│   ├── module/
│   │   ├── fitgd.mjs        # Main module (imports from dist/)
│   │   └── dialogs.mjs      # Dialog forms
│   ├── templates/            # Handlebars templates
│   │   ├── character-sheet.html
│   │   ├── crew-sheet.html
│   │   └── styles/
│   ├── lang/                 # Localization
│   └── dist/                 # Built library (auto-generated, ignored by git)
│       ├── fitgd-core.es.js
│       └── fitgd-core.umd.js
│
└── tests/                    # Test suite
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start watch mode for live development |
| `npm run build` | Type-check + build library once |
| `npm run build:lib` | Build library without type-checking |
| `npm run build:watch` | Watch mode (alias: `npm run dev`) |
| `npm test` | Run tests in watch mode |
| `npm run test:ui` | Run tests with UI dashboard |
| `npm run test:coverage` | Generate test coverage report |
| `npm run type-check` | Run TypeScript type checker |
| `npm run docs` | Generate API documentation |
| `npm run docs:watch` | Generate docs in watch mode |
| `npm run benchmark` | Run performance benchmarks |

## Debugging in Foundry VTT

### Browser DevTools (F12)

```javascript
// Access the Redux store
window.fitgd.getState()

// Access the API
window.fitgd.api()

// Export current state
window.fitgd.exportHistory()

// Example: Check Momentum
window.fitgd.getState().crews.byId['crew-id'].currentMomentum

// Example: Get all harm clocks
window.fitgd.getState().clocks.byTypeAndEntity['harm:character-id']
```

### Enable Foundry Dev Mode

In Foundry VTT:
1. Settings → Configure Settings
2. Core Settings → Enable Developer Mode
3. Restart Foundry

This enables:
- Better error messages
- Module reload without full refresh
- Development-friendly logging

## Common Development Tasks

### Adding a New Redux Action

1. **Write tests first** (`tests/unit/`)
2. Add action to appropriate slice (`src/slices/`)
3. Add API method (`src/api/implementations/`)
4. Update types if needed (`src/types/`)
5. Run tests: `npm test`

### Adding a New Foundry Dialog

1. Add dialog class to `foundry/module/dialogs.mjs`
2. Import and wire up in `foundry/module/fitgd.mjs`
3. Add event listener in sheet class
4. Update template HTML if needed
5. Add CSS styling in `foundry/templates/styles/`
6. Refresh Foundry (F5) to test

### Modifying Handlebars Templates

1. Edit template files in `foundry/templates/`
2. Refresh Foundry (F5) - **no rebuild needed**
3. Changes are immediate (symlink = live files)

### Updating CSS Styles

1. Edit `foundry/templates/styles/fitgd-sheets.css`
2. Refresh Foundry (F5) - **no rebuild needed**
3. Use browser DevTools to inspect elements

## Troubleshooting

### "Module not found" error in Foundry

**Cause:** Built library not found

**Solution:**
```bash
# Check if dist files exist
ls foundry/dist/

# If missing, build:
npm run build

# Then restart Foundry VTT
```

### Watch mode not detecting changes

**Cause:** File system watching issues

**Solution:**
```bash
# Kill watch process (Ctrl+C)
# Restart it:
npm run dev
```

### Symlink broken or not working

**Cause:** Symlink was deleted or moved

**Solution:**
```bash
# Remove broken link
rm /path/to/FoundryVTT/Data/systems/forged-in-the-grimdark

# Recreate it
ln -s /home/user/fitgd/foundry /path/to/FoundryVTT/Data/systems/forged-in-the-grimdark
```

### Changes not appearing in Foundry

**Checklist:**
1. ✅ Watch mode running? (`npm run dev`)
2. ✅ Did you refresh Foundry? (F5)
3. ✅ Check browser console for errors (F12)
4. ✅ Hard refresh if needed (Ctrl+Shift+R / Cmd+Shift+R)
5. ✅ Restart Foundry VTT if all else fails

### TypeScript errors in watch mode

**Cause:** Type errors prevent build

**Solution:**
```bash
# Run type checker to see all errors
npm run type-check

# Fix the errors, then restart watch mode
npm run dev
```

## Performance Tips

### Fast Refresh Workflow

1. Keep Foundry VTT window side-by-side with your code editor
2. Use keyboard shortcut for quick refresh (F5)
3. Use browser DevTools "Preserve Log" to keep console history
4. Enable Foundry Dev Mode for better error messages

### Efficient Testing

Run tests in watch mode in a separate terminal:

```bash
npm test
```

Changes to source files automatically re-run affected tests.

## Hot Tips

1. **Use the browser console** - The Redux store is exposed at `window.fitgd`
2. **Check command history** - Every action is logged and stored
3. **Leverage sourcemaps** - Vite generates sourcemaps for debugging
4. **Test incrementally** - Small changes + immediate testing = faster development
5. **Watch the tests** - Keep tests running to catch regressions early

## Next Steps

- Read [CLAUDE.md](./CLAUDE.md) for architecture overview
- Check [docs/EXAMPLES.md](./docs/EXAMPLES.md) for API usage examples
- Review [foundry/README.md](./foundry/README.md) for Foundry-specific docs
- Run benchmarks: `npm run benchmark`

Happy developing! 🎲
