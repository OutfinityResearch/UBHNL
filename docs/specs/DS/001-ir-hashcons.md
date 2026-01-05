# DS-001: IR and Hash-Consing

## Goal
Define the internal representation (IR) for UBH and guarantee maximal structural sharing.

## Decisions
- Each gate is a tuple: (op, in1, in2). CONST and VAR use op with metadata.
- Inputs are ordered for commutative ops (XOR, AND) to enforce canonical form.
- A global hash table maps (op, in1, in2) -> nodeId.
- Node IDs are stable and monotonic, assigned on first creation.

## Invariants
- No duplicate gate nodes with the same canonical signature.
- All nodes are immutable after creation.
- CONST0 and CONST1 are singletons.

## Rationale
Hash-consing compresses large repeated subgraphs and simplifies solver encoding.

## Notes
Future optimizers may add algebraic factoring, but must preserve invariants.
