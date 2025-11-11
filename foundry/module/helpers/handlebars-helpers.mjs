/**
 * Handlebars Helper Registration
 *
 * Registers custom Handlebars helpers for the system templates
 */

// @ts-check

/**
 * Register all Handlebars helpers
 */
export function registerHandlebarsHelpers() {
  // Times helper (for loops)
  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; ++i)
      accum += block.fn(i);
    return accum;
  });

  // Equals helper
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // Less than or equal
  Handlebars.registerHelper('lte', function(a, b) {
    return a <= b;
  });

  // Greater than or equal
  Handlebars.registerHelper('gte', function(a, b) {
    return a >= b;
  });

  // Less than
  Handlebars.registerHelper('lt', function(a, b) {
    return a < b;
  });

  // Checked helper for checkboxes
  Handlebars.registerHelper('checked', function(value) {
    return value ? 'checked' : '';
  });

  // Add helper for arithmetic
  Handlebars.registerHelper('add', function(a, b) {
    return a + b;
  });

  // Clock rendering helper
  Handlebars.registerHelper('clockSVG', function(clockData, options) {
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
    const editable = options.hash.editable !== undefined ? options.hash.editable : game.user.isGM;

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
  Handlebars.registerHelper('default', function(value, defaultValue) {
    return value != null ? value : defaultValue;
  });

  // Capitalize first letter
  Handlebars.registerHelper('capitalize', function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Uppercase entire string
  Handlebars.registerHelper('uppercase', function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toUpperCase();
  });

  // Subtract helper for arithmetic
  Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
  });

  // Join array with separator
  Handlebars.registerHelper('join', function(arr, separator) {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator || ', ');
  });

  // Max value in array
  Handlebars.registerHelper('max', function(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return Math.max(...arr);
  });
}
