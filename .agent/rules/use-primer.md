---
trigger: always_on
---

# Primary source of truth
Use vault/rules_primed.md as the ultimate source of truth.
 
## Game config
One of the expression of these rules are the definitions in gameConfig.ts, if you encounter inconsistencies in data or logic, first go to the rules primer and gameConfig.ts, both should have consistent information. If there are any inconsistencies IMMEDIATELY stop work and inform the user. 
This means data corruption and you will work on incorrect instructions. 

This consistency should be reflected in all layers of the application.

# Application layers:

## Redux
/src/ - contains redux based logic that is application agnostic, typescript.
/tests/ - unit and integration tests for redux based logic, typescript.

## Foundry 
/foundry/ - contains the usage of Redux store and integrated with foundry VTT api, can affect foundry based state and settings, typescript.

## UI
/foundry/templates/ - html, css, handles - layer where most of the issues happen due to lack of type safety.