/**
 * Type-Safe Dataset Helpers
 *
 * Provides typed, validated access to HTML data attributes.
 * Prevents silent failures from missing/malformed attributes.
 */

/* -------------------------------------------- */
/*  Dataset Interfaces                          */
/* -------------------------------------------- */

/**
 * Clock-related data attributes
 */
export interface ClockDataset {
  clockId: string;
  clockValue?: string;
  clockMax?: string;
  segment?: string;
  currentSegments?: string;
}

/**
 * Action rating data attributes
 */
export interface ActionDataset {
  action: string;
  value: string;
}

/**
 * Trait-related data attributes
 */
export interface TraitDataset {
  traitId: string;
  traitName?: string;
}

/**
 * Equipment-related data attributes
 */
export interface EquipmentDataset {
  equipmentId: string;
}

/**
 * Character-related data attributes
 */
export interface CharacterDataset {
  characterId: string;
}

/**
 * Generic action data attributes
 */
export interface ActionTypeDataset {
  action: string;
  type?: string;
}

/* -------------------------------------------- */
/*  Typed Dataset Getters                       */
/* -------------------------------------------- */

/**
 * Safely extract clock-related data attributes
 * @param element - HTML element with data attributes
 * @returns Typed clock dataset
 * @throws If required clockId attribute is missing
 */
export function getClockDataset(element: HTMLElement): ClockDataset {
  const clockId = element.dataset.clockId;

  if (!clockId) {
    throw new Error('Required data-clock-id attribute is missing');
  }

  return {
    clockId,
    clockValue: element.dataset.clockValue,
    clockMax: element.dataset.clockMax,
    segment: element.dataset.segment,
    currentSegments: element.dataset.currentSegments,
  };
}

/**
 * Safely extract action rating data attributes
 * @param element - HTML element with data attributes
 * @returns Typed action dataset
 * @throws If required action or value attributes are missing
 */
export function getActionDataset(element: HTMLElement): ActionDataset {
  const action = element.dataset.action;
  const value = element.dataset.value;

  if (!action) {
    throw new Error('Required data-action attribute is missing');
  }

  if (!value) {
    throw new Error('Required data-value attribute is missing');
  }

  return { action, value };
}

/**
 * Safely extract trait-related data attributes
 * @param element - HTML element with data attributes
 * @returns Typed trait dataset
 * @throws If required traitId attribute is missing
 */
export function getTraitDataset(element: HTMLElement): TraitDataset {
  const traitId = element.dataset.traitId;

  if (!traitId) {
    throw new Error('Required data-trait-id attribute is missing');
  }

  return {
    traitId,
    traitName: element.dataset.traitName,
  };
}

/**
 * Safely extract equipment-related data attributes
 * @param element - HTML element with data attributes
 * @returns Typed equipment dataset
 * @throws If required equipmentId attribute is missing
 */
export function getEquipmentDataset(element: HTMLElement): EquipmentDataset {
  const equipmentId = element.dataset.equipmentId;

  if (!equipmentId) {
    throw new Error('Required data-equipment-id attribute is missing');
  }

  return { equipmentId };
}

/**
 * Safely extract character-related data attributes
 * @param element - HTML element with data attributes
 * @returns Typed character dataset
 * @throws If required characterId attribute is missing
 */
export function getCharacterDataset(element: HTMLElement): CharacterDataset {
  const characterId = element.dataset.characterId;

  if (!characterId) {
    throw new Error('Required data-character-id attribute is missing');
  }

  return { characterId };
}

/**
 * Safely extract action type data attributes
 * @param element - HTML element with data attributes
 * @returns Typed action type dataset
 * @throws If required action attribute is missing
 */
export function getActionTypeDataset(element: HTMLElement): ActionTypeDataset {
  const action = element.dataset.action;

  if (!action) {
    throw new Error('Required data-action attribute is missing');
  }

  return {
    action,
    type: element.dataset.type,
  };
}

/* -------------------------------------------- */
/*  Generic Helpers                             */
/* -------------------------------------------- */

/**
 * Safely parse numeric dataset value with validation
 * @param element - HTML element with data attributes
 * @param key - Dataset key to parse
 * @param defaultValue - Optional default if attribute is missing
 * @returns Parsed number
 * @throws If attribute is missing (when no default) or not a valid number
 *
 * @example
 * // With default value
 * const amount = getDatasetInt(element, 'amount', 1);
 *
 * @example
 * // Without default (throws if missing)
 * const segments = getDatasetInt(element, 'segments');
 */
export function getDatasetInt(
  element: HTMLElement,
  key: string,
  defaultValue?: number
): number {
  const value = element.dataset[key];

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required data-${key} attribute is missing`);
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`data-${key}="${value}" is not a valid number`);
  }

  return parsed;
}

/**
 * Get typed enum value from dataset
 * @param element - HTML element with data attributes
 * @param key - Dataset key to get
 * @param allowedValues - Array of allowed enum values
 * @returns Typed enum value
 * @throws If attribute is missing or not in allowedValues
 *
 * @example
 * const type = getDatasetEnum(element, 'type', ['harm', 'crew-clock'] as const);
 * // type is 'harm' | 'crew-clock'
 */
export function getDatasetEnum<T extends string>(
  element: HTMLElement,
  key: string,
  allowedValues: readonly T[]
): T {
  const value = element.dataset[key];

  if (!value) {
    throw new Error(`Required data-${key} attribute is missing`);
  }

  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `data-${key}="${value}" is not a valid value. ` +
        `Expected one of: ${allowedValues.join(', ')}`
    );
  }

  return value as T;
}

/**
 * Get optional string from dataset
 * @param element - HTML element with data attributes
 * @param key - Dataset key to get
 * @param defaultValue - Default value if attribute is missing
 * @returns String value or default
 *
 * @example
 * const name = getDatasetString(element, 'name', 'Unknown');
 */
export function getDatasetString(
  element: HTMLElement,
  key: string,
  defaultValue?: string
): string | undefined {
  const value = element.dataset[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Get required string from dataset
 * @param element - HTML element with data attributes
 * @param key - Dataset key to get
 * @returns String value
 * @throws If attribute is missing
 *
 * @example
 * const id = getDatasetStringRequired(element, 'id');
 */
export function getDatasetStringRequired(
  element: HTMLElement,
  key: string
): string {
  const value = element.dataset[key];

  if (!value) {
    throw new Error(`Required data-${key} attribute is missing`);
  }

  return value;
}
