# FS (Functional Specification)

## Core Functions
- Create wires and gates: const0, const1, var, xor, and.
- Add constraints: assert1, assert0, assertEq.
- Reasoning: solve(), prove(phi).

## Solver Behavior
- SAT/UNSAT response with optional model.
- XOR equations handled as linear constraints.

## Front-end Contract
- Input: typed AST.
- Output: UBH wires and assertions.
- Quantifiers: finite expansion or lazy instantiation.
