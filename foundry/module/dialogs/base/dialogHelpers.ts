/**
 * Dialog Helper Functions
 *
 * Shared utilities for dialog operations
 */

/**
 * Prompt user for text input
 *
 * @param title - Dialog title
 * @param label - Input label
 * @param defaultValue - Default input value
 * @returns User input or null if cancelled
 */
export async function promptForText(
  title: string,
  label: string,
  defaultValue: string = ''
): Promise<string | null> {
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
          callback: (html: JQuery) => {
            const value = html.find('[name="input-text"]').val() as string;
            resolve(value?.trim() || null);
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
 * @param title - Dialog title
 * @param message - Confirmation message
 * @returns True if confirmed, false otherwise
 */
export async function confirmAction(
  title: string,
  message: string
): Promise<boolean> {
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
