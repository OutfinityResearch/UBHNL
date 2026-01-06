# DS-002: Solver Interface and XOR Handling

## Goal
Provide a SAT-centric solver with native XOR reasoning for efficiency on polynomial circuits.

This spec focuses on *interfaces and responsibilities*. It does not mandate a particular SAT implementation;
the SAT component may be:
- an internal solver implementation, or
- an adapter to an external solver.

## Core Idea (Two Sub-Solvers)
UBH constraints naturally split into:
- **linear** constraints over GF(2) (XOR),
- **non-linear** constraints (AND).

So the solver is a cooperation between:
1) a CNF/SAT engine (handles AND via Tseitin), and
2) an XOR engine (incremental Gaussian elimination).

## Decisions
### CNF Encoding (AND)
- For each AND gate `z = and(a,b)`, add Tseitin clauses enforcing `z ↔ (a ∧ b)`:
  - `(¬a ∨ ¬b ∨ z)`
  - `(a ∨ ¬z)`
  - `(b ∨ ¬z)`
- This encoding is linear in the number of AND gates.

### XOR as Linear Equations
- XOR constraints are stored as linear equations over GF(2).
- Treat the following as *linear* (XOR-side) constraints:
  - `ASSERT1(w)`  → equation `w = 1`
  - `ASSERT0(w)`  → equation `w = 0`
  - `ASSERT_EQ(a,b)` → equation `a ⊕ b = 0`
  - XOR gate definitions: for `z = xor(a,b)` add `z ⊕ a ⊕ b = 0`

### Propagation Model
The solver runs a CDCL/DPLL(T)-style search with two propagation channels:
1) CNF unit propagation
2) XOR propagation via incremental Gaussian elimination

## Solver Interface (Kernel-Level)
The kernel’s external API is defined in `docs/specs/UBH-SPEC.md`. Internally, the solver is split as:

### SAT Backend (Pluggable)
Required capabilities:
- `addClauses(clauses: int[][])` incremental addition
- `solve(assumptions?: int[]) -> { status: "SAT"|"UNSAT"|"UNKNOWN", model?: int[], certificate?: Certificate }`
  - assumptions are signed literals (`+v` / `-v`) if supported
- optional: `unsatCore() -> int[]` (over assumptions or clause groups)
- optional but recommended: emit DRAT/LRAT proofs for `UNSAT` results.

### XOR Backend (Incremental)
Required capabilities:
- `addEquation(vars: int[], rhs: 0|1, originId)`
- `assume(var: int, value: 0|1, originId)`
- `propagate(partialAssignment) -> { implied: Map<var,value>, conflict?: Conflict }`
- optional: `explain(var) -> Origin[]` and `explainConflict() -> Origin[]`

Note: “originId” is a stable identifier for the higher-level constraint source, used for diagnostics.

## Interface
- solve() returns `SAT/UNSAT/UNKNOWN` and optional model/certificate.
- prove(phi) is implemented as solve(T + NOT(phi)).
- optional unsatCore() returns contributing constraints.

## Incremental Behavior
- Constraints are added monotonically.
- solve() may be called repeatedly; internal state is preserved.

## Rationale
Pure CNF encoding of XOR is expensive; mixed reasoning matches UBH core.

## Mixed Solving Loop (Reference)
This is the high-level control loop; details depend on the SAT backend.

1) Maintain a partial assignment `A` over UBH node ids.
2) Repeat until fixpoint:
   - Run CNF unit propagation given `A`; add implied assignments to `A`.
   - Feed any new assignments into XOR backend; run XOR propagation; add implied assignments to `A`.
   - If either side reports a conflict:
     - produce `UNSAT` if at decision level 0,
     - otherwise backtrack via SAT decision stack.
3) If all relevant vars assigned and no conflicts, report `SAT`.
4) Otherwise ask SAT backend to choose a decision literal; extend `A` and continue (with clause learning if supported).

Certificate rule (system-level, DS-011):
- `UNSAT` must be accompanied by a checkable certificate (e.g., DRAT/LRAT), or the result must be treated as `UNKNOWN` until confirmed.

## Example (XOR + AND)
Given:
- `z = and(x, y)`  (CNF)
- `x = 1`          (XOR unit equation)
- `z = 1`          (XOR unit equation)

Propagation should force `y = 1`:
- From CNF: `z=1` implies `x=1` and `y=1` (via `(a ∨ ¬z)` / `(b ∨ ¬z)`).
- XOR side already had `x=1`, so it is consistent.

Contradiction example:
- `z = and(x, y)`
- `z = 1`
- `x = 0`
This must be `UNSAT` (CNF conflict at decision level 0).

## Diagnostics / Explainability Hooks
To enable “proof in CNL” at higher layers:
- Every kernel constraint should carry an `origin` payload (source span, DSL/CNL statement id).
- SAT clauses and XOR equations should be grouped by origin.
- On `UNSAT`, return:
  - best-effort unsat core (origins),
  - and/or a proof trace if the SAT backend supports it.
