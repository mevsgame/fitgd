/**
 * Dialog Helper Functions
 *
 * Shared utilities for dialog operations
 */

// @ts-check

/**
 * Prompt user for text input
 *
 * @param {string} title - Dialog title
 * @param {string} label - Input label
 * @param {string} [defaultValue=''] - Default input value
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export async function promptForText(title, label, defaultValue = '') {
  return new Promise((resolve) => {
    new Dialog({
      title: title,
      content: `
        <div class="form-group">
          <label>${label}</label>
          <input type="text" name="input-text" value="${defaultValue}" autofocus>
        </div>
      `,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: 'OK',
          callback: (html) => {
            const value = html.find('[name="input-text"]').val().trim();
            resolve(value || null);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel',
          callback: () => resolve(null),
        },
      },
      default: 'ok',
      close: () => resolve(null),
    }).render(true);
  });
}

/**
 * Confirm action with user
 *
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
export async function confirmAction(title, message) {
  return new Promise((resolve) => {
    new Dialog({
      title: title,
      content: `<p>${message}</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Yes',
          callback: () => resolve(true),
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: 'No',
          callback: () => resolve(false),
        },
      },
      default: 'yes',
      close: () => resolve(false),
    }).render(true);
  });
}
