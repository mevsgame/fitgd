# Equipment Compendium

This directory is for equipment item templates for your Forged in the Grimdark game.

## Creating Equipment Items

### In Foundry VTT

1. Go to the **Items** tab
2. Click "Create Item"
3. Set type to "equipment"
4. Fill in the equipment details:
   - **Name:** The equipment's name
   - **Tier:** accessible / inaccessible / epic
   - **Category:** weapon / armor / tool / consumable / misc
   - **Description:** What it does and how it affects gameplay
   - **Image:** Optional icon/image path
5. Drag the item into the Equipment compendium to save as a template

### Equipment Tiers

**Accessible:** Standard gear available to all characters. Can be added freely from character sheet.

**Inaccessible:** Specialized gear requiring training or connections. Requires 1 Momentum flashback + trait justification.

**Epic:** Legendary equipment that must be earned through story. Cannot be acquired via flashbacks.

### Categories

- **Weapon:** Offensive gear (firearms, melee weapons, etc.)
- **Armor:** Protective gear (body armor, shields, etc.)
- **Tool:** Utility equipment (scanners, tools, communication devices)
- **Consumable:** Single-use or limited-use items (grenades, medical supplies)
- **Misc:** Other equipment types

## Template Factory Pattern

Equipment items in this compendium serve as **templates**. When a character acquires equipment:

1. The item data is **copied** to Redux (not referenced)
2. The character's copy is fully editable (name, description, tier, etc.)
3. Changes to the template do NOT affect existing equipment
4. Deleting the template does NOT affect existing equipment

This preserves event sourcing and allows per-character customization (e.g., renaming "Standard Rifle" to "Kane's Lucky Rifle").

## Example JSON Format

If you want to create equipment items via JSON import:

```json
{
  "name": "Basic Weapon",
  "type": "equipment",
  "img": "icons/weapons/generic-weapon.webp",
  "system": {
    "description": "<p>A standard weapon. Can improve Position in combat situations.</p>",
    "tier": "accessible",
    "category": "weapon"
  },
  "flags": {}
}
```

Place JSON files in this directory and import them via:
- Compendium Packs → Equipment → Right-click → Import Data
