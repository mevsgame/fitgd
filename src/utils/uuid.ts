/**
 * UUID Generation Utility
 *
 * Uses crypto.randomUUID() for generating UUIDs.
 * Available in Node 14.17+ and modern browsers.
 */

export function generateId(): string {
  // Use native crypto.randomUUID() if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older environments (not cryptographically secure)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
