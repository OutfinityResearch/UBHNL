# Spec: src/kernel/constants.mjs

## Goal
Define the primitive operation codes for the UBH kernel. Separating this allows circular dependencies to be broken if `Wire` types need to be referenced by other modules without pulling in the whole Store.

## Dependencies
- None.

## Public Exports

### Constants (Gate Types)
- `OP_CONST0`: 0
- `OP_CONST1`: 1
- `OP_VAR`: 2
- `OP_XOR`: 3
- `OP_AND`: 4

## Logic
- Use Integers for Opcodes for performance and memory efficiency.
