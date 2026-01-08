# Spec: src/session/builtins.mjs

## Goal
Define the standard library constants, domains, predicates, and functions as specified in **DS-19**. Separating this keeps `vocab.mjs` generic.

## Dependencies
- None.

## Public Exports

### Function `injectBuiltins(vocab)`
- **Input**: `Vocabulary` instance.
- **Action**:
  - Adds domains: `Entity`, `Bool`, `Int`, `Nat`, `Real`, `String`.
  - Adds constants: `true`, `false`.
  - Adds predicates: `Equal`, `NotEqual`, `LessThan`, etc.
  - Adds functions: `Add`, `Sub`, `Mul`, etc.

## Logic
- Pure configuration/population logic.
- Ensures the "standard environment" is available in every empty session.
