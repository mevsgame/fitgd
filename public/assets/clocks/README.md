# Clock SVG Assets

## Source Attribution

Clock visual assets are borrowed from the **Blades in the Dark Foundry VTT system**:
- Repository: https://github.com/Dez384/foundryvtt-blades-in-the-dark
- License: MIT
- Original Path: `/themes/*/[size]clock_[value].svg`

## How to Obtain Assets

### Manual Download

1. Visit: https://github.com/Dez384/foundryvtt-blades-in-the-dark/tree/master/themes
2. Download the following theme directories:
   - `red/` - For physical harm clocks
   - `grey/` - For morale harm clocks
   - `blue/` - For progress clocks
   - `yellow/` - For addiction clocks
   - `green/` - For consumable clocks

3. Place them in `/public/assets/clocks/themes/` maintaining the directory structure:
   ```
   public/assets/clocks/themes/
   ├── red/
   │   ├── 4clock_0.svg
   │   ├── 4clock_1.svg
   │   ├── ...
   │   ├── 6clock_0.svg
   │   ├── 6clock_1.svg
   │   ├── ...
   ├── grey/
   │   └── ...
   ├── blue/
   │   └── ...
   ├── yellow/
   │   └── ...
   └── green/
       └── ...
   ```

### Automated Download (Git Sparse Checkout)

```bash
# Clone just the themes directory
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/Dez384/foundryvtt-blades-in-the-dark.git temp_blades

cd temp_blades
git sparse-checkout set themes

# Copy the needed themes
cp -r themes/red ../public/assets/clocks/themes/
cp -r themes/grey ../public/assets/clocks/themes/
cp -r themes/blue ../public/assets/clocks/themes/
cp -r themes/yellow ../public/assets/clocks/themes/
cp -r themes/green ../public/assets/clocks/themes/

cd ..
rm -rf temp_blades
```

## Clock Asset Mapping (FitGD → Colors)

| FitGD Mechanic | Color | Segments | Usage |
|----------------|-------|----------|-------|
| **Physical Harm** | Red | 6 | Character harm clocks (bleeding, broken bones, etc.) |
| **Morale Harm** | Grey | 6 | Character harm clocks (shaken, haunted, etc.) |
| **Progress Clock** | Blue | 4, 6, 8, 12 | Long-term projects, obstacles, personal goals |
| **Threat Clock** | Red | 4, 6, 8, 12 | Countdown clocks, enemy plans |
| **Addiction Clock** | Yellow | 8 | Crew-wide stim addiction tracking |
| **Consumable Clock** | Green | 4, 6, 8 | Grenade/stim/equipment depletion |

## Required Files

### Red (Physical Harm + Threats)
- `6clock_0.svg` through `6clock_6.svg` (harm)
- `4clock_0.svg` through `4clock_4.svg` (threats)
- `6clock_0.svg` through `6clock_6.svg` (threats)
- `8clock_0.svg` through `8clock_8.svg` (threats)
- `12clock_0.svg` through `12clock_12.svg` (threats)

### Grey (Morale Harm)
- `6clock_0.svg` through `6clock_6.svg`

### Blue (Progress Clocks)
- `4clock_0.svg` through `4clock_4.svg`
- `6clock_0.svg` through `6clock_6.svg`
- `8clock_0.svg` through `8clock_8.svg`
- `12clock_0.svg` through `12clock_12.svg`

### Yellow (Addiction)
- `8clock_0.svg` through `8clock_8.svg`

### Green (Consumables)
- `4clock_0.svg` through `4clock_4.svg` (rare)
- `6clock_0.svg` through `6clock_6.svg` (uncommon)
- `8clock_0.svg` through `8clock_8.svg` (common)

## Usage in Foundry

In Foundry VTT sheets, reference clocks with the path:

```html
<img src="assets/clocks/themes/{{color}}/{{size}}clock_{{value}}.svg" />
```

Example:
```html
<!-- Physical harm clock at 3/6 -->
<img src="assets/clocks/themes/red/6clock_3.svg" />

<!-- Addiction clock at 5/8 -->
<img src="assets/clocks/themes/yellow/8clock_5.svg" />

<!-- Progress clock at 4/8 -->
<img src="assets/clocks/themes/blue/8clock_4.svg" />
```

## FitGD vs. Blades in the Dark

**Important:** While we use their clock visuals, FitGD mechanics differ significantly:

| Mechanic | Blades in the Dark | FitGD (Forged in the Grimdark) |
|----------|-------------------|--------------------------------|
| Resource | Stress (0-9) | **Momentum** (0-10) |
| Harm | 4 levels (light/medium/heavy/deadly) | **Harm Clocks** (6 segments, max 3) |
| Recovery | Downtime, Vice rolls | **Rally** (at 0-3 Momentum) |
| Permanent Effect | Trauma (4 max) | **Scar Traits** (no cap) |
| Consumables | Load system | **Consumable Clocks** (depletion tracking) |
| Addiction | None | **Addiction Clock** (8 segments, crew-wide) |

## License & Attribution

These assets are used under MIT License from the Blades in the Dark Foundry VTT implementation.

See main README.md for full attribution details.
