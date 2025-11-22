import type { ClockColor } from './types';
import type { Clock } from '../../types/clock';

/**
 * Clock Renderer Utilities
 *
 * Generates SVG paths for clock visualization in Foundry VTT
 * Uses assets from Blades in the Dark Foundry VTT (MIT License)
 */

/**
 * Generate clock SVG path for Foundry
 */
export function getClockSVGPath(
  color: ClockColor,
  size: number,
  value: number
): string {
  // Path format: assets/clocks/themes/{color}/{size}clock_{value}.svg
  return `assets/clocks/themes/${color}/${size}clock_${value}.svg`;
}

/**
 * Get clock rendering data from Redux Clock entity
 */
export function getClockRenderData(clock: Clock): {
  color: ClockColor;
  size: number;
  value: number;
  svgPath: string;
} {
  const color = determineClockColor(clock);
  const size = clock.maxSegments;
  const value = clock.segments;

  return {
    color,
    size,
    value,
    svgPath: getClockSVGPath(color, size, value),
  };
}

/**
 * Determine clock color based on type and metadata
 */
function determineClockColor(clock: Clock): ClockColor {
  switch (clock.clockType) {
    case 'harm':
      // Morale harm uses grey, physical harm uses red
      if (clock.subtype?.toLowerCase().includes('morale') ||
        clock.subtype?.toLowerCase().includes('shaken')) {
        return 'grey';
      }
      return 'red';

    case 'addiction':
      return 'yellow';

    case 'progress':
      // Check if it's a threat/countdown
      const metadata = clock.metadata || {};
      if (metadata.isCountdown || metadata.category === 'threat') {
        return 'red';
      }
      if (metadata.category === 'personal-goal') {
        return 'white';
      }
      if (metadata.category === 'faction') {
        return 'black';
      }
      // Default: blue for progress
      return 'blue';

    default:
      return 'blue'; // Fallback
  }
}

/**
 * Preload clock SVG assets for a given clock
 * (Useful for Foundry to cache assets)
 */
export function preloadClockAssets(clock: Clock): string[] {
  const color = determineClockColor(clock);
  const size = clock.maxSegments;
  const paths: string[] = [];

  // Generate all possible states for this clock
  for (let i = 0; i <= size; i++) {
    paths.push(getClockSVGPath(color, size, i));
  }

  return paths;
}

/**
 * Generate HTML for clock display
 * (For use in Foundry templates)
 */
export function getClockHTML(
  clock: Clock,
  options: {
    width?: string;
    height?: string;
    cssClass?: string;
    alt?: string;
  } = {}
): string {
  const { color, size, value, svgPath } = getClockRenderData(clock);

  const width = options.width || '100px';
  const height = options.height || '100px';
  const cssClass = options.cssClass || 'clock';
  const alt = options.alt || `${clock.subtype || 'Clock'} (${value}/${size})`;

  return `
    <img
      src="${svgPath}"
      alt="${alt}"
      class="${cssClass} clock-${size} clock-${color}"
      width="${width}"
      height="${height}"
      data-clock-id="${clock.id}"
      data-clock-type="${clock.clockType}"
      data-clock-value="${value}"
      data-clock-max="${size}"
    />
  `.trim();
}

/**
 * Get Handlebars helper for clock rendering
 * (For use in Foundry templates similar to Blades implementation)
 */
export function getClockHandlebarsHelper() {
  return function (
    this: any,
    clockData: Clock,
    options: { hash: { width?: string; height?: string; class?: string } }
  ): string {
    return getClockHTML(clockData, {
      width: options.hash.width,
      height: options.hash.height,
      cssClass: options.hash.class,
    });
  };
}

/**
 * Interactive clock click handler data
 * Returns the new value when a clock is clicked at a position
 */
export function getClockClickValue(
  clock: Clock,
  clickPosition: { x: number; y: number },
  elementBounds: { width: number; height: number }
): number {
  // Calculate which segment was clicked based on position
  // Clocks are divided into pie slices radiating from center

  const centerX = elementBounds.width / 2;
  const centerY = elementBounds.height / 2;

  // Calculate angle from center
  const dx = clickPosition.x - centerX;
  const dy = clickPosition.y - centerY;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Normalize angle to 0-360, starting from top (12 o'clock)
  angle = (angle + 90 + 360) % 360;

  // Calculate which segment (0-based)
  const segmentAngle = 360 / clock.maxSegments;
  const clickedSegment = Math.floor(angle / segmentAngle);

  // Return the new value (clicked segment + 1, or 0 if already filled)
  const newValue = clickedSegment + 1;
  return newValue > clock.segments ? newValue : Math.max(0, newValue - 1);
}
