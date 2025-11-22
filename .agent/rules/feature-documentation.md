---
trigger: always_on
---

# Feature Documentation Rule

This rule defines the workflow for documenting features in the docs/ directory. It serves as a secondary source of truth, implementing the high-level rules from vault/rules_primer.md into specific feature contexts.

## Purpose
To provide a lean, information-packed source of truth for the LLM when working on specific features, bridging the gap between high-level rules and code implementation.

## Workflow

1.  **Registry**: Maintain docs/index.md as a central registry of all features.
2.  **Dedicated Documents**: Create a dedicated markdown file for each feature in docs/[feature-name].md.
3.  **Sub-features**: If functionality is shared or reused, define it as a 'Sub-feature' and reference it in the relevant feature documents to avoid repetition and inconsistencies.
4.  **Primary Source**: Always reference vault/rules_primer.md as the ultimate source of truth. If there is a conflict, vault/rules_primer.md takes precedence.

## Documentation Structure

To ensure documentation is concrete and useful, every feature document MUST include the following sections where applicable:

### 1. Overview
Brief description of the feature's purpose and user flow.

### 2. Architecture & State
- **Redux Slices**: Which state slices does this feature read/write? (e.g., playerRoundState, characters, crews)
- **Selectors**: Key selectors used to derive data (e.g., selectDicePool, selectActiveEquipment).
- **State Machine**: If the feature uses a state machine (like PlayerActionWidget), document the states and transitions.
- **Transactions**: Does the feature use a transaction pattern (e.g., building up state in a widget before committing to persistent storage)? Document what is transient and when it gets committed.

### 3. Implementation Details
- **Handlers**: List any dedicated Handler classes (e.g., StimsWorkflowHandler) that encapsulate business logic.
- **Bridge API**: How does this feature use the Bridge API for cross-client updates? (e.g., executeBatch, specific action types).
- **UI Components**: List related Widgets, Dialogs, and Handlebars templates.

### 4. Rules Integration
- **Primary Rules**: Explicitly link to the relevant sections in vault/rules_primer.md.
- **Edge Cases**: Document any specific rule interpretations or edge cases handled by this feature.

## When to Use

The LLM should decide to use this rule in the following scenarios:

1.  **Consultation**: When tasked with working on an existing feature, ALWAYS check its corresponding documentation in docs/ to understand the implementation details and constraints.
2.  **Maintenance**: After modifying a feature's implementation (code or HTML), YOU MUST update its documentation to reflect the changes. This ensures the documentation remains a reliable secondary source of truth.
3.  **Synchronization**: If vault/rules_primer.md is modified, YOU MUST review and update relevant feature documentation to ensure it remains consistent with the primary rules.