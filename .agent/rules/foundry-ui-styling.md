---
trigger: model_decision
description: To use when adjusting html and styling, especially after user feedback, even more so if screenshots are provided.
---

# Foundry UI & Styling Guidelines

This rule captures best practices and common pitfalls when working with Foundry VTT UI elements in this project, specifically regarding Dialogs and Theming.

## 1. Visual Verification Protocol (CRITICAL)
**Context**: Code reading is insufficient for UI work. Implicit styles, inheritance, and framework quirks often mean "correct" looking code produces broken UI.
**Rule**: You cannot verify UI/Styling changes by reading code or checking unit tests.

**Requirement**:
1.  **Capture Screenshot**: You MUST verify the "fixed" state with a browser screenshot.
2.  **Verify Screenshot**: Look at the actual pixels. Does it match the design? Are there scrollbars? Is the text readable?
3.  **No Assumptions**: Do not claim a fix is done until you have seen the proof. If a discrepancy exists between code and visual outcome, trust the visual outcome and investigate further.

## 2. Dialog Implementation
When extending the Dialog class or creating custom applications:

### Constructor Signature
Foundry's Dialog constructor (and most Applications) accepts two main arguments: data and options.
**Common Mistake**: Passing classes or width inside the data object.
**Correct Usage**: Pass styling and configuration options in the **second** argument.

`	typescript
//  CORRECT
super(
  {
    title: "My Dialog", // Window title
    content: htmlContent,
    buttons: myButtons,
    default: "ok"
  },
  {
    // Styling classes go here
    classes: ['fitgd', 'dialog', 'fitgd-dialog', 'my-custom-class'],
    width: 400,
    ...options
  } // <--- Options object is the second argument
);
`

### Titles
- **Do not** duplicate the title in the HTML content (e.g., an <h2> at the top of the form) if it is already set as the Window 	itle in the constructor.
- The Window title is sufficient and standard.

## 3. Theming
The project uses a dark theme override managed by fitgd-sheets.css.

- **Key Class**: Ensure the class itgd-dialog is applied to any Dialog to pick up the dark theme overrides (background #1a1a1a, text #e0e0e0).
- **Selector**: The CSS targets .dialog.fitgd-dialog.
- **Inheritance**: If a dialog looks "parchment" or "light", you likely forgot to add itgd-dialog to the classes array in the options object.
