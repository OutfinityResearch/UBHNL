# URS (User Requirements Specification)

## Purpose
Provide a minimal kernel that models and solves Boolean constraints using XOR/AND/CONST and exposes a stable async API.

## User Goals
- Represent Boolean theories as circuits over GF(2).
- Prove or refute queries via SAT/UNSAT with optional models.
- Compile higher-level logics into the same kernel.

## Scope
- Kernel IR and solver integration.
- Front-end compilation contract (not full NLP parsing).

## Out of Scope
- Full SAT solver implementation in v0.
- Large-scale database or UI.
