# Equipment Compendium

This directory contains sample equipment items for the Forged in the Grimdark system.

## Importing into Foundry

To populate the equipment compendium with these sample items:

1. Start Foundry VTT and load your world
2. Go to the **Compendium Packs** tab
3. Find the "Equipment" compendium (under Forged in the Grimdark)
4. Right-click the compendium and select "Import Data"
5. Select the JSON files from this directory

Alternatively, you can create items directly in Foundry:

1. Go to the **Items** tab
2. Click "Create Item"
3. Set type to "equipment"
4. Fill in the fields from the JSON files
5. Drag the items into the Equipment compendium

## Equipment Tiers

### Accessible
Standard gear available to all characters. Can be added freely from character sheet.

- Lasgun (weapon)
- Autogun (weapon)
- Flak Armor (armor)
- Dataslate (tool)

### Inaccessible
Specialized gear requiring training or connections. Requires 1 Momentum flashback + trait justification.

- Power Sword (weapon)
- Plasma Gun (weapon)
- Carapace Armor (armor)
- Auspex (tool)

### Epic
Legendary equipment that must be earned through story. Cannot be acquired via flashbacks.

- Relic Blade of Saint Macharius (weapon)
- Power Armor (armor)

## Template Factory Pattern

These items serve as **templates**. When a character acquires equipment:

1. The item data is **copied** to Redux (not referenced)
2. The character's copy is fully editable (name, description, tier, etc.)
3. Changes to the template do NOT affect existing equipment
4. Deleting the template does NOT affect existing equipment

This preserves event sourcing and allows per-character customization (e.g., "Sergeant Kane's Lucky Lasgun").
