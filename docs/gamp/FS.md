# FS (Functional Specification)

## Core Functions
- Create wires and gates: const0, const1, var, xor, and.
- Add constraints: assert1, assert0, assertEq.
- Reasoning: solve(), prove(phi).

## Solver Behavior
- `SAT/UNSAT/UNKNOWN` response with optional model/certificate.
- XOR equations handled as linear constraints.
- Acceptance rule: never return an uncheckable `UNSAT` claim; treat it as `UNKNOWN` until confirmed by a checkable route.

## Front-end Contract
- Input: typed AST.
- Output: UBH wires and assertions.
- Quantifiers: finite expansion or lazy instantiation.

## Session Functions (System-Level)
- Manage a lexicon (domains/constants/predicates) for typing.
- `learn(input)`:
  - accept CNL or DSL,
  - compile and add constraints/schemas incrementally,
  - attach origin ids for explainability.
- `query(input)`:
  - accept CNL or DSL,
  - support entailment (`T ⊨ φ`), model finding, and hole filling (`?`),
  - return explanations as unsat cores or counterexample summaries.
