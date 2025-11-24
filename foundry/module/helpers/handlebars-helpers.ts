/**
 * Handlebars Helper Registration
 *
 * Registers custom Handlebars helpers for the system templates
 */

import { getConfigForContext } from './equipmentTemplateConfig';

/**
 * Clock data structure for clockSVG helper
 */
interface ClockData {
  id: string;
  clockType: string;
  subtype?: string;
  name?: string;
  segments: number;
  maxSegments: number;
  metadata?: {
    isCountdown?: boolean;
    category?: string;
    [key: string]: unknown;
  };
}

/**
 * Handlebars helper options with hash properties
 */
interface HelperOptions {
  fn?: (context: unknown) => string;
  hash: {
    width?: string;
    height?: string;
    class?: string;
    editable?: boolean;
    [key: string]: any;
  };
}

/**
 * Register all Handlebars helpers and partials
 */
export async function registerHandlebarsHelpers(): Promise<void> {
  // Register partials manually using Handlebars.registerPartial
  // This ensures the partial is available by name in templates
  const partials = [
    'equipment-grid',
    'equipment-row-view',
    'gm-passive-grid',
  ];

  try {
    // Load each partial template and register it
    for (const partial of partials) {
      const path = `systems/forged-in-the-grimdark/templates/partials/${partial}.html`;
      console.log(`FitGD | Loading partial: ${partial} from ${path}`);

      // Fetch the template file
      const response = await fetch(path);
      if (!response.ok) {
        console.error(`FitGD | Failed to load partial ${partial}: ${response.status}`);
        continue;
      }

      const templateSource = await response.text();
      // Register with Handlebars using just the partial name (no .html extension)
      Handlebars.registerPartial(partial, templateSource);
      console.log(`FitGD | Registered Handlebars partial: ${partial}`);
    }
  } catch (error) {
    console.error('FitGD | Error registering partials:', error);
  }
  // Times helper (for loops)
  Handlebars.registerHelper('times', function (n: number, block: HelperOptions) {
    let accum = '';
    for (let i = 0; i < n; ++i)
      accum += block.fn!(i);
    return accum;
  });

  // Equals helper
  Handlebars.registerHelper('eq', function (a: unknown, b: unknown) {
    return a === b;
  });

  // Less than or equal
  Handlebars.registerHelper('lte', function (a: number, b: number) {
    return a <= b;
  });

  // Greater than or equal
  Handlebars.registerHelper('gte', function (a: number, b: number) {
    return a >= b;
  });

  // Less than
  Handlebars.registerHelper('lt', function (a: number, b: number) {
    return a < b;
  });

  // Checked helper for checkboxes
  Handlebars.registerHelper('checked', function (value: boolean) {
    return value ? 'checked' : '';
  });

  // Add helper for arithmetic
  Handlebars.registerHelper('add', function (a: number, b: number) {
    return a + b;
  });

  // Clock rendering helper
  Handlebars.registerHelper('clockSVG', function (clockData: ClockData, options: HelperOptions) {
    if (!clockData) return '';

    // Determine clock color based on type and metadata
    let color = 'blue'; // default
    switch (clockData.clockType) {
      case 'harm':
        // Morale harm uses grey, physical harm uses red
        if (clockData.subtype?.toLowerCase().includes('morale') ||
          clockData.subtype?.toLowerCase().includes('shaken')) {
          color = 'grey';
        } else {
          color = 'red';
        }
        break;
      case 'consumable':
        color = 'green';
        break;
      case 'addiction':
        color = 'yellow';
        break;
      case 'progress':
        // Check if it's a threat/countdown
        const metadata = clockData.metadata || {};
        if (metadata.isCountdown || metadata.category === 'threat') {
          color = 'red';
        } else if (metadata.category === 'personal-goal') {
          color = 'white';
        } else if (metadata.category === 'faction') {
          color = 'black';
        } else {
          color = 'blue';
        }
        break;
    }

    const size = clockData.maxSegments;
    const value = clockData.segments;
    const svgPath = `systems/forged-in-the-grimdark/assets/clocks/themes/${color}/${size}clock_${value}.svg`;

    const width = options.hash.width || '100px';
    const height = options.hash.height || '100px';
    const cssClass = options.hash.class || 'clock';
    const editable = options.hash.editable !== undefined ? options.hash.editable : game.user!.isGM;

    const alt = `${clockData.subtype || clockData.name || 'Clock'} (${value}/${size})`;

    return new Handlebars.SafeString(`
      <div class="clock-container ${editable ? 'editable' : ''}">
        <img
          src="${svgPath}"
          alt="${alt}"
          class="${cssClass} clock-${size} clock-${color}"
          width="${width}"
          height="${height}"
          data-clock-id="${clockData.id}"
          data-clock-type="${clockData.clockType}"
          data-clock-value="${value}"
          data-clock-max="${size}"
          data-clock-color="${color}"
        />
      </div>
    `);
  });

  // Default value helper (returns second arg if first is falsy)
  Handlebars.registerHelper('default', function (value: unknown, defaultValue: unknown) {
    return value != null ? value : defaultValue;
  });

  // Capitalize first letter
  Handlebars.registerHelper('capitalize', function (str: unknown) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Uppercase entire string
  Handlebars.registerHelper('uppercase', function (str: unknown) {
    if (!str || typeof str !== 'string') return '';
    return str.toUpperCase();
  });

  // Subtract helper for arithmetic
  Handlebars.registerHelper('subtract', function (a: number, b: number) {
    return a - b;
  });

  // Join array with separator
  Handlebars.registerHelper('join', function (arr: unknown, separator: string) {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator || ', ');
  });

  // Max value in array
  Handlebars.registerHelper('max', function (arr: unknown) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return Math.max(...arr);
  });

  // Check if equipment array has items of a given category
  Handlebars.registerHelper('hasEquipmentByCategory', function (equipment: unknown, category: string) {
    if (!Array.isArray(equipment)) return false;
    return (equipment as any[]).some((item) => item.category === category);
  });

  // Get equipment template config for a given context
  Handlebars.registerHelper('getConfigForContext', function (context: string) {
    try {
      return getConfigForContext(context as any);
    } catch (error) {
      console.error('FitGD | Error getting equipment config:', error);
      return {};
    }
  });

  // Format timestamp as human-readable date
  Handlebars.registerHelper('formatTimestamp', function (timestamp: unknown) {
    if (!timestamp || typeof timestamp !== 'number') return 'Unknown date';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  });

  // Object helper to create config objects in templates
  Handlebars.registerHelper('object', function (options: HelperOptions) {
    // console.log('FitGD | object helper called with:', options.hash);
    return options.hash;
  });

  // Lowercase helper
  Handlebars.registerHelper('toLowerCase', function (str: unknown) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase();
  });

  console.log('FitGD | Registered object and toLowerCase helpers');
}
