# DS-001: IR and Hash-Consing

## Goal
Define the internal representation (IR) for UBH and guarantee maximal structural sharing (structural compression).

## Overview
UBH represents Boolean expressions as a DAG where each wire id denotes a wire:
- `CONST0`, `CONST1`
- `VAR(name)` (an input wire)
- `XOR(a,b)`, `AND(a,b)` (derived wires)

Structural sharing is achieved by **hash-consing**: identical (canonical) wires are deduplicated.

## Terminology

| Term | Meaning |
|------|---------|
| **AST node** | A syntax tree element in the parser/translator (ForAll, Implies, Predicate). |
| **Wire** | A Boolean value in the UBH circuit (produced by a constant, input variable, or gate). |
| **Gate** | An operation that produces a wire (AND, XOR, VAR, CONST). |
| **Wire id** | An integer identifier that refers to a wire. |

Avoid using the bare term "node" in kernel contexts; prefer **wire** for values and **gate** for operations.

## Decisions
### Wire Shape
- Each non-constant gate wire is represented as a tuple `(op, a, b)` where:
  - `op ∈ {XOR, AND}`
  - `a` and `b` are input wire ids
- Constants are singleton wire ids.
- Variables are wire ids keyed by a stable string name: `VAR(name)`.

### Canonical Form
To make “identical” well-defined:
- For commutative ops (`XOR`, `AND`) inputs are ordered by id:
  - `(op, a, b)` is canonical iff `a ≤ b`.
- Simplifications are applied *before* hashing (see below).
- Canonicalization must happen before signature hashing so that:
  - `xor(a,b)` == `xor(b,a)` (same id)
  - `and(a,b)` == `and(b,a)` (same id)

### Hash-Consing Table
- A map `sig -> wireId` stores the canonical signature for every created wire.
- A separate map `varName -> wireId` stores `VAR` wires.
- Wire ids are stable within a single kernel instance and are assigned monotonically on first creation.

## Data Structures (Reference)
This is intentionally language-agnostic; the Node.js implementation can use arrays + `Map`.

### Wire Record
For each `wireId`:
- `op`: `"CONST0" | "CONST1" | "VAR" | "XOR" | "AND"`
- `a`, `b`: input wire ids for binary ops (otherwise null)
- `name`: only for `VAR`

### WireStore API (Conceptual)
- `const0(): id`
- `const1(): id`
- `var(name: string): id`
- `xor(a: id, b: id): id`
- `and(a: id, b: id): id`
- `getNode(id): Node`

## Simplification at Construction Time
The kernel applies only *local* rewrites that are:
- cheap (O(1)),
- satisfiability-preserving, and
- compatible with hash-consing.

Rules (from `docs/specs/DS/DS00-vision.md`):
- `xor(x, CONST0) = x`
- `xor(x, x) = CONST0`
- `and(x, CONST0) = CONST0`
- `and(x, CONST1) = x`
- `and(x, x) = x`

## Hash-Consing Algorithm (Pseudo)
Gate creation:
```
function mkBinary(op, a, b):
  (a, b) = simplify(op, a, b)
  if op is commutative and a > b:
    swap(a, b)
  sig = encode(op, a, b)
  if sig in sigToId:
    return sigToId[sig]
  id = wires.length
  wires.push({ op, a, b })
  sigToId[sig] = id
  return id
```

Variable creation:
```
function mkVar(name):
  if name in varToId:
    return varToId[name]
  id = wires.length
  wires.push({ op: "VAR", name })
  varToId[name] = id
  return id
```

## Invariants
- No duplicate gate wires with the same canonical signature.
- All wires are immutable after creation.
- `CONST0` and `CONST1` are singletons.

## Edge Cases / Clarifications
- **Ordering after simplification**: ordering must happen *after* simplification, otherwise `xor(x,x)` could hash as `(x,x)` instead of rewriting to `CONST0`.
- **Variable names**: the kernel treats variable names as opaque strings. Scoping and typing are handled at higher layers (DSL/CNL/session).
- **Id stability**: ids are stable only within a single running kernel instance; persistence is handled above the kernel.
- **n-ary XOR/AND**: the kernel is strictly binary. Front-ends may build balanced trees; the solver may internally flatten XOR chains into a single linear equation (see DS-002).

## Rationale
Hash-consing compresses large repeated subgraphs and simplifies solver encoding.

## Example (Structural Sharing)
Build `or(x, y)` twice:
```
x  = var("x")
y  = var("y")
t1 = xor(x, y)
t2 = and(x, y)
o1 = xor(t1, t2)     # OR(x,y)
o2 = xor(xor(x,y), and(x,y))
assert(o1 === o2)    # same wire id via hash-consing
```
