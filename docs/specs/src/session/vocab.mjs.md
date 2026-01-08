# Spec: src/session/vocab.mjs

## Goal
Manage the symbol table. It strictly enforces that every symbol used in a theory is declared.

## Dependencies
- `src/utils/errors.mjs`: For lookup errors.
- `src/session/builtins.mjs`: To initialize defaults.

## Public Exports

### Class `Vocabulary`
- **Constructor**: `()` calls `injectBuiltins(this)`.

- **Methods**:
  - `addDomain(name)`
  - `addConst(name, domain)`
  - `addPredicate(name, argTypes)`
  - `addFunction(name, argTypes, returnType)`
  - `addAlias(alias, target)`
  - `resolveSymbol(name)` -> `{ kind, ... }`
  - `merge(otherVocab)`

## Logic
- **Validation**: Throw `E_UNKNOWN_TYPE` if adding a constant of unknown domain.
- **Aliasing**: `resolveSymbol` should follow aliases (max depth or loop detection, though aliases are usually simple renames).
- **Case Sensitivity**: DSL is case-sensitive, so Maps are keyed by exact string.
