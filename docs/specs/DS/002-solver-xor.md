# DS-002: Solver Interface and XOR Handling

## Goal
Provide a SAT-centric solver with native XOR reasoning for efficiency on polynomial circuits.

## Decisions
- AND gates are compiled via Tseitin CNF (linear blowup).
- XOR constraints are stored as linear equations over GF(2).
- The solver runs a DPLL-style search with two propagation channels:
  1) CNF unit propagation
  2) XOR Gaussian elimination

## Interface
- solve() returns SAT/UNSAT and optional model.
- prove(phi) is implemented as solve(T + NOT(phi)).
- optional unsatCore() returns contributing constraints.

## Incremental Behavior
- Constraints are added monotonically.
- solve() may be called repeatedly; internal state is preserved.

## Rationale
Pure CNF encoding of XOR is expensive; mixed reasoning matches UBH core.
