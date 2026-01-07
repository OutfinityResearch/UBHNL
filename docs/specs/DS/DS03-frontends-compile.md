# DS-003: Front-end Compilation

## Goal
Define the compilation contract from higher-level logics into UBH.

## Scope
This DS specifies what a front-end must produce so the UBH kernel can solve it.
It is intentionally agnostic to whether the front-end starts from:
- a CNL surface form (DS-005/006),
- an intermediate DSL (DS-008),
- a programmatic API.

## Pipeline (Front-end → UBH)
1) Parse/construct a **typed logic AST**.
2) Lower all types to one of:
   - `Bit` (kernel-level),
   - `BitVector[k]` (library-level),
   - `FiniteDomain[D]` (library-level).
3) Lower the logic to a small **core logic**:
   - `forall, exists, and, or, not, implies`, `iff`, `eq`
4) Compile core logic to UBH gates (`xor/and/const/var`) and kernel constraints (`assert0/1/eq`).
5) For large quantifiers, emit schemas instead of full expansion (DS-004).

## Type Lowering (Concrete Rules)
All higher-level values must ultimately become bits:

### Booleans
- `Bool -> Bit`

### Integers (bounded)
- `Int[k] -> BitVector[k]`
  - Representation: two's complement by default.
  - Operations: bit-blasted circuits (adder, comparator) built from XOR/AND.

### Enums / Finite Domains
- `Enum[n] -> BitVector[ceil(log2(n))]` (binary encoding) **or** `BitVector[n]` (one-hot).
  - The choice is a front-end policy; binary is compact, one-hot is often propagation-friendly.
  - Must add *domain constraints* so the bit-pattern is a valid element (especially for binary encoding when `n` is not a power of 2).

### Sets over a Finite Universe
- `Set(U) -> BitVector[|U|]` (bitset encoding)
  - Example: `in(x, S)` becomes “select bit” at index of `x`.

### Relations (finite)
- `Rel(U,V) -> BitMatrix[|U|×|V|]` (or flattened bitvector)

## Logic Lowering (Core Operators)
Core logic operators can be compiled to UBH gates using only `{XOR, AND, CONST1}`:
- `not(a)` := `xor(CONST1, a)`
- `or(a,b)` := `xor(xor(a,b), and(a,b))`
- `and(a,b)` := `and(a,b)` (kernel gate)
- `implies(a,b)` := `or(not(a), b)`
- optional `iff(a,b)` := `not(xor(a,b))`

Front-ends may introduce additional derived operators, but must lower them to this basis.

## Quantifiers (Finite Domains)
Quantifiers are compiled over **finite** domains when the target is UBH.

If a front-end needs infinite domains or richer quantification, it must:
- choose a different fragment/backend (e.g., SMT, QBF), or
- apply an abstraction/refinement tactic (e.g., CEGAR) that eventually reduces to finite problems.

### Semantics (Important Edge Cases)
Let `D` be a finite domain and `P(x)` a Boolean expression:
- `forall x in D: P(x)` means `∧_{d∈D} P(d)`
  - If `D` is empty: the result is `true` (`CONST1`).
- `exists x in D: P(x)` means `∨_{d∈D} P(d)`
  - If `D` is empty: the result is `false` (`CONST0`).

These are not just math trivia: they affect compilation and must be tested.

### Expansion vs Lazy Instantiation
- **Finite expansion** is allowed for small domains (configurable threshold).
- **Lazy instantiation** (schema engine, DS-004) is required for large domains to preserve compression.

## Concrete Example 1 (Rule)
Rule: `A ∧ B -> C`

Lower:
- `implies(and(A,B), C)`

Compile to UBH:
1) `t = and(A, B)`
2) `na = not(t)`  (i.e., `xor(1, t)`)
3) `phi = or(na, C)` (derived OR)
4) `assert1(phi)`

## Concrete Example 2 (Finite FOL)
Domain: `Cell = {c0,c1}`
Rule: `forall c in Cell: geneA(c) -> proteinP(c)`

Expansion (small domain):
- `(geneA(c0) -> proteinP(c0)) ∧ (geneA(c1) -> proteinP(c1))`
Each implication becomes an asserted UBH subcircuit.

Lazy instantiation (large domain):
- keep as schema and instantiate only when a model violates it (DS-004).

## Rationale
Compilation keeps the kernel minimal while enabling many logics. The explicit lowering rules guarantee:
- determinism (no “guessing” semantics),
- consistent behavior across front-ends,
- and a clear boundary for testing.
