# Mechanic: Equipment Management

## Overview
Equipment in *Forged in the Grimdark* is not just a static inventory but a dynamic resource managed through **Load**, **Tiers**, and **Momentum**. This system allows players to adapt their loadout to the mission while enforcing strategic constraints.

## Architecture & State

### State Slices
- **`characterSlice`**: Stores the character's current `loadout` (list of item IDs) and `equipped` status.
- **`crewSlice`**: Stores **Momentum**, which is required for acquiring Rare items or using Flashback items.

### UI Components
- **`EquipmentManagementDialog`**: The primary interface for modifying loadout during a mission or downtime.
- **`EquipmentGridTemplate`**: A reusable Handlebars partial for displaying items in a grid (used in Character Sheet and Dialog).
- **`EquipmentSheet`**: The editor for defining item stats (Type, Tier, Modifiers).

## UI/UX Design

### 1. Equipment Grid Template
A standardized grid view used across the application to display items.
- **Visuals**:
    - **Equipped Items**: Shown at the top, highlighted.
    - **Unequipped Items**: Shown below, dimmed.
    - **Locked**: Icon indicating the item cannot be unequipped (mission in progress).
    - **Depleted**: Visual state for used consumables (still takes load, but grayed out/crossed off).
- **Interactions**:
    - **Hover**: Shows item details (Tier, Modifiers, Description).
    - **Click**: Toggles equipped state (if in Management Dialog).

### 2. Equipment Management Dialog
The central hub for deciding loadout. Accessible via **Character Sheet** and **Player Action Widget**.
- **Header**: Shows current **Load** (e.g., "3/5") and **Momentum** (e.g., "4M").
- **Body**: Uses the **Equipment Grid Template** to list all available items.
- **Search**: Filter items by name or tag.
- **Flashback Creation**: Button to "Create Flashback Item" (creates new item + equips it immediately).
- **Footer**:
    - **Momentum Cost**: Displays total cost of changes (e.g., "Cost: 1M" for equipping a Rare item).
    - **Actions**: "Cancel" (revert changes) and "Accept" (commit changes and spend Momentum).

### 3. Equipment Sheet (Item Editor)
Refined interface for defining item properties.
- **Fields**:
    - **Name & Description**.
    - **Type**: Equipment, Consumable, or Augmentation.
    - **Tier**: Common, Rare (1M cost), Epic.
    - **Modifiers**:
        - **Position**: Bonus/Penalty (e.g., +1 Step).
        - **Effect**: Bonus/Penalty (e.g., +1 Level).
        - **Dice Pool**: Bonus dice (e.g., +1d).

### 4. Character Sheet Integration
- **Display**: Shows accessible items using the Grid Template.
- **GM Override**: GM can toggle equip state directly on the sheet without Momentum costs or dialogs.
- **Player Access**: "Manage Equipment" button opens the Management Dialog.

## Implementation Details

### Load Management
- **Load Limit**: Characters have a maximum load (default: **5**).
- **Locking**: Once an item is equipped during a mission, it is **locked** until the next **Momentum Reset**.
- **Validation**: The UI prevents equipping items if it would exceed the max load.

### Item Tiers & Acquisition
1.  **Common**: Standard gear. Can be equipped freely if within load limits.
2.  **Rare**: Specialized gear. Requires spending **1 Momentum** to equip (representing a Flashback to acquiring it).
3.  **Epic**: Legendary gear. Cannot be acquired via Flashback; must be earned in-game.

### Flashback Items
- **Goal**: Acquire a specific item *now* that wasn't equipped at the start.
- **Cost**: **1 Momentum** (plus the item's load cost).
# Mechanic: Equipment Management

## Overview
Equipment in *Forged in the Grimdark* is not just a static inventory but a dynamic resource managed through **Load**, **Tiers**, and **Momentum**. This system allows players to adapt their loadout to the mission while enforcing strategic constraints.

## Architecture & State

### State Slices
- **`characterSlice`**: Stores the character's current `loadout` (list of item IDs) and `equipped` status.
- **`crewSlice`**: Stores **Momentum**, which is required for acquiring Rare items or using Flashback items.

### UI Components
- **`EquipmentManagementDialog`**: The primary interface for modifying loadout during a mission or downtime.
- **`EquipmentGridTemplate`**: A reusable Handlebars partial for displaying items in a grid (used in Character Sheet and Dialog).
- **`EquipmentSheet`**: The editor for defining item stats (Type, Tier, Modifiers).

## UI/UX Design

### 1. Equipment Grid Template
A standardized grid view used across the application to display items.
- **Visuals**:
    - **Equipped Items**: Shown at the top, highlighted.
    - **Unequipped Items**: Shown below, dimmed.
    - **Locked**: Icon indicating the item cannot be unequipped (mission in progress).
    - **Depleted**: Visual state for used consumables (still takes load, but grayed out/crossed off).
- **Interactions**:
    - **Hover**: Shows item details (Tier, Modifiers, Description).
    - **Click**: Toggles equipped state (if in Management Dialog).

### 2. Equipment Management Dialog
The central hub for deciding loadout. Accessible via **Character Sheet** and **Player Action Widget**.
- **Header**: Shows current **Load** (e.g., "3/5") and **Momentum** (e.g., "4M").
- **Body**: Uses the **Equipment Grid Template** to list all available items.
- **Search**: Filter items by name or tag.
- **Flashback Creation**: Button to "Create Flashback Item" (creates new item + equips it immediately).
- **Footer**:
    - **Momentum Cost**: Displays total cost of changes (e.g., "Cost: 1M" for equipping a Rare item).
    - **Actions**: "Cancel" (revert changes) and "Accept" (commit changes and spend Momentum).

### 3. Equipment Sheet (Item Editor)
Refined interface for defining item properties.
- **Fields**:
    - **Name & Description**.
    - **Type**: Equipment, Consumable, or Augmentation.
    - **Tier**: Common, Rare (1M cost), Epic.
    - **Modifiers**:
        - **Position**: Bonus/Penalty (e.g., +1 Step).
        - **Effect**: Bonus/Penalty (e.g., +1 Level).
        - **Dice Pool**: Bonus dice (e.g., +1d).

### 4. Character Sheet Integration
- **Display**: Shows accessible items using the Grid Template.
- **GM Override**: GM can toggle equip state directly on the sheet without Momentum costs or dialogs.
- **Player Access**: "Manage Equipment" button opens the Management Dialog.

## Implementation Details

### Load Management
- **Load Limit**: Characters have a maximum load (default: **5**).
- **Equipped**: Items marked as "Equipped" are part of your current loadout. They appear in the Player Action Widget dropdowns and are available for use. You can freely unequip them *unless* they are locked.
- **Locked**: Once an item is **used** in a roll (or acquired via Flashback), it becomes **Locked**. Locked items cannot be unequipped until the next **Momentum Reset**:
    - **When Locking Occurs**: Items are locked when the roll is committed (in the `_onRoll` handler), not when selected in the dropdown
    - **Visual Indication**: Locked items show a lock icon and have their checkbox disabled in the Character Sheet
    - **Enforcement**: The Character Sheet's `_onToggleEquipped` handler validates that locked items cannot be unequipped:
        - If a player attempts to unequip a locked item, they see a warning: "This item is locked until Momentum Reset"
        - The checkbox is automatically reverted to the checked state
    - **Purpose**: This allows you to "auto-equip" a standard loadout but change your mind about unused gear during the mission. Once committed to using an item, you cannot swap it out.
- **Validation**: The UI prevents equipping items if it would exceed the max load.

### Item Tiers & Acquisition
1.  **Common**: Standard gear. Can be equipped freely if within load limits.
2.  **Rare**: Specialized gear. Requires spending **1 Momentum** to equip (representing a Flashback to acquiring it).
3.  **Epic**: Legendary gear. Cannot be acquired via Flashback; must be earned in-game.

### Flashback Items
- **Goal**: Acquire a specific item *now* that wasn't equipped at the start.
- **Cost**: **1 Momentum** (plus the item's load cost).
- **Mechanic**: Creates a temporary item and immediately equips it.
- **Constraint**: Cannot exceed max load. If full, the player cannot use a Flashback Item without first finding a way to free up load (rare).

### Consumables
- **Usage**: Single-use items (grenades, stims).
- **State**: When used, they remain "equipped" (taking up load) but are marked as **depleted**.
- **Reset**: Consumables are removed or replenished during a Momentum Reset.

### Augmentations
- **Nature**: Permanent cybernetic or biological enhancements.
- **Usage**: Count towards Load like any other equipment.
- **Activation**: Always equipped. Can be explicitly enabled for a specific roll via the Player Action Widget if relevant.
- **Effect**: When enabled, they provide their defined bonuses (Position, Effect, or Dice) to the current roll transaction.

## Rules Integration
- **Momentum Cost**: Enforces the 1 Momentum cost for Rare items and Flashback items.
- **Load Hard Cap**: The 5-item limit is a hard constraint to force difficult choices.
- **Reset Cycle**: Equipment locks are only cleared during a specific "Momentum Reset" event, not automatically after every scene.
