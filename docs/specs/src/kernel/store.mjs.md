# Spec: src/kernel/store.mjs

## Goal
Implement the UBH **WireStore** and Hash-Consing mechanism (DS-01). This module manages the DAG of gates and ensures structural uniqueness.

## Dependencies
- `src/kernel/constants.mjs`: For opcodes.

## Public Exports

### Types
- `NodeId`: number (integer alias)
- `Wire`: `{ op: number, a: number, b: number, label?: string }`

### Class `WireStore`
- **Constructor**: `()`
  - Init arrays/maps.
  - Create `CONST0` and `CONST1` immediately.

- **Methods**:
  - `const0(): NodeId`
  - `const1(): NodeId`
  - `var(label: string): NodeId`
  - `xor(a: NodeId, b: NodeId): NodeId`
  - `and(a: NodeId, b: NodeId): NodeId`
  - `not(a: NodeId): NodeId` (helper)
  - `or(a: NodeId, b: NodeId): NodeId` (helper)
  - `getWire(id: NodeId): Wire`
  - `stats(): Object` (debug info)

## Logic & Constraints
- **Hash-Consing**:
  - Key = `op + ":" + min(a,b) + ":" + max(a,b)` (for commutative).
  - Use a `Map<string, NodeId>` for the cache.
- **Simplification (On-the-fly)**:
  - Implement the identities from DS-01 (e.g., `xor(x,x)=0`) *before* lookup/creation.
- **Immutability**:
  - Once a wire is created, it never changes.
- **Size**:
  - Start with simple Arrays/Maps. Optimize for TypedArrays later if memory becomes an issue (post-MVP).
