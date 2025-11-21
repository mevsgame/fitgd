/**
 * Foundry VTT Global Type Declarations
 * 
 * These types are available at runtime when running in Foundry VTT,
 * but need to be declared for TypeScript compilation.
 */

declare global {
    const foundry: {
        utils?: {
            randomID?: () => string;
        };
    } | undefined;
}

export { };
