# UBH Core Specification

## 1. Scope
UBH (Universal Boolean Hypergraph) defines a minimal kernel for:
- representing Boolean expressions as a hash-consed DAG of gates over `{0,1}`, and
- reasoning about Boolean constraints via `SAT/UNSAT` (with native XOR handling).

Everything above the kernel (CNL/DSL parsing, finite-domain FOL, temporal encodings, probabilistic layers) is specified as a *front-end* that compiles into UBH constraints. See:
- `docs/specs/src/system-spec.md` for the full system layering (CNL → DSL → UBH),
- `docs/specs/DS/` for design-level decisions.

Non-goal: UBH is not “a logic”; it is a minimal substrate for many logics.

## 2. Core Data Model
### 2.1 Nodes (Wires)
- Each wire is a Boolean variable with value in {0,1}.
- Wires are identified by stable integer IDs within a single kernel instance.

Terminology note: “wire” and “node id” are used interchangeably. A node id denotes the output wire of either:
- a constant,
- an input variable, or
- a derived gate (XOR/AND) whose value is functionally determined by its inputs.

### 2.2 Gate Types
Required gate constructors:
- CONST0
- CONST1
- VAR (named input wire)
- XOR(a, b)
- AND(a, b)

Derived:
- NOT(x) := XOR(CONST1, x)
- OR(x, y) := XOR(XOR(x, y), AND(x, y))

### 2.3 Hypergraph
- The representation is a DAG of gates (hash-consed).
- Identical gates MUST be deduplicated (same op and inputs) to maximize structural sharing.
- All gate creation is pure: no mutation of existing nodes.

## 3. Semantics (Simple and Explicit)
Let an *assignment* be a function `σ: VAR -> {0,1}` that assigns values to all `VAR` nodes.
Evaluation `⟦id⟧_σ` is defined recursively:
- `⟦CONST0⟧_σ = 0`
- `⟦CONST1⟧_σ = 1`
- `⟦VAR(name)⟧_σ = σ(name)`
- `⟦XOR(a,b)⟧_σ = ⟦a⟧_σ ⊕ ⟦b⟧_σ`
- `⟦AND(a,b)⟧_σ = ⟦a⟧_σ ∧ ⟦b⟧_σ`

GF(2) view (optional but useful):
- XOR is addition modulo 2.
- AND is multiplication.
So each node denotes a polynomial over GF(2) evaluated on Boolean inputs.

## 4. Constraint Model
A theory is a set of constraints over wires:
- ASSERT1(w): w == 1
- ASSERT0(w): w == 0
- ASSERT_EQ(a, b): a == b (encoded as XOR(a, b) == 0)

Equations are polynomials in GF(2) set to 0.

## 5. Kernel API
Minimal async API (hosted as JS module, async-first). All ids are node ids:
- const0() -> id
- const1() -> id
- var(name) -> id
- xor(a, b) -> id
- and(a, b) -> id
- assert1(w, originId?)
- assert0(w, originId?)
- assertEq(a, b, originId?)
- solve() -> {
    status: "SAT" | "UNSAT" | "UNKNOWN",
    model?: Map<id, 0|1>,
    certificate?: { kind: string, data: any },
    unsatCore?: OriginId[]
  }
- prove(phi) -> {
    status: "PROVED" | "DISPROVED" | "UNKNOWN",
    model?: Map<id, 0|1>,
    certificate?: { kind: string, data: any },
    unsatCore?: OriginId[]
  }

prove(phi) is defined as solve(T && NOT(phi)).

Origin note:
- `originId` is an opaque identifier supplied by higher layers (DSL/CNL/session) to support unsat cores and explanations.

### 5.1 Determinism Contract
- For a given kernel instance, repeated creation of the “same” `VAR` or gate MUST return the same id (hash-consing).
- For commutative gates (`XOR`, `AND`), the kernel MUST canonicalize input order so `xor(a,b)` == `xor(b,a)`.
- Node ids are required to be stable only within the process lifetime. Persistence (stable ids across runs) is handled above the kernel.

## 6. Simplification Rules (Kernel-Level)
Lightweight rewrites applied at creation time (before hash-consing):
- XOR(x, 0) = x
- XOR(x, x) = 0
- AND(x, 0) = 0
- AND(x, 1) = x
- AND(x, x) = x
- NOT(x) = XOR(1, x)

These MUST NOT change satisfiability.

## 7. Solving Strategy
- CNF: AND gates are encoded with Tseitin clauses.
- XOR: XOR constraints (including `ASSERT_EQ` and `ASSERT0/1`) are treated as linear equations over GF(2) with incremental Gaussian elimination.
- SAT decisions propagate into XOR; XOR propagation can force SAT assignments.

## 8. Proof and Diagnostics
- `UNSAT` should optionally return a minimal-ish unsat core (subset of constraints + origins).
- If proof traces are supported, store DRAT (or equivalent) for external checking.

Acceptance rule (system-level, see DS-011):
- `SAT` is accepted if the returned model satisfies all constraints under UBH evaluation.
- `UNSAT` is accepted only if accompanied by a checkable certificate (e.g., DRAT/LRAT) or confirmed by a trusted checker route.

## 9. Front-end Integration Contract
Front-ends are responsible for:
- Defining data types as bitvectors or finite domains.
- Compiling high-level formulas to UBH gates/constraints.
- Implementing quantifiers via finite expansion or lazy instantiation (CEGAR).

## 10. CNL/NL Front-end Requirements
- A controlled natural language (CNL) layer produces a typed AST (possibly via an intermediate DSL).
- A lexicon defines symbols, arities, and finite domains.
- The compiler must be deterministic; ambiguous parses are rejected.
- The AST lowers to the core logic (forall/exists/and/or/not/implies) before UBH compilation.

## 11. Non-Goals
- The kernel does not parse natural language.
- The kernel does not implement rich types beyond Bit.
- The kernel does not expose any solver-specific internal state.
