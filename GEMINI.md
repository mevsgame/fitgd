# Project: Forged in the Grimdark - Redux Core

## Project Overview

This project is a **TypeScript and Redux Toolkit-based event-sourced state management system** for the "Forged in the Grimdark" tabletop role-playing game. It is designed to be agnostic of the Foundry VTT platform but fully compatible with it.

The core of the system is a Redux store that manages the game state, including character sheets, crew information, and various in-game mechanics like clocks and momentum. The architecture emphasizes a clean separation between the core game logic (in Redux) and the user interface (in Foundry VTT). A "Bridge API" facilitates communication between the two layers.

The project follows a **Test-Driven Development (TDD)** approach and has an extensive test suite with over 700 tests.

## Key Technologies

*   **Language:** TypeScript
*   **State Management:** Redux Toolkit
*   **Build Tool:** Vite
*   **Test Runner:** Vitest
*   **Package Manager:** pnpm (npm is also supported)

## Building and Running

### Installation

```bash
pnpm install
```

### Building the Project

To build the project, which includes compiling the TypeScript code, run:

```bash
pnpm run build
```

To build specifically for Foundry VTT, use:

```bash
pnpm run build:foundry
```

### Running Tests

To run the entire test suite:

```bash
pnpm test
```

To run tests with a UI:
```bash
pnpm test:ui
```

### Type Checking

To run the TypeScript compiler to check for type errors without emitting JavaScript files:

```bash
pnpm run type-check:all
```

This command checks both the core project and the Foundry-specific code.

## Development Conventions

The project has a very detailed development guide in `CLAUDE.md`. Here are some of the most important conventions:

*   **TDD is required.** All new features must start with failing tests.
*   **Strict separation of concerns.** All business logic resides in the Redux layer, not in the Foundry VTT widgets.
*   **Use the Bridge API.** All interactions between Foundry VTT and the Redux store should go through the `game.fitgd.bridge` API.
*   **Use selectors for all state queries.** This ensures that data access is memoized, testable, and type-safe.
*   **Centralized configuration.** All game-related constants are stored in `src/config/gameConfig.ts`.
*   **`vault/rules_primer.md` is sacred.** This file contains the canonical game rules and must not be modified without explicit user consent.

Before committing any code, make sure to run:

```bash
pnpm run type-check:all
pnpm run build
pnpm test
```
