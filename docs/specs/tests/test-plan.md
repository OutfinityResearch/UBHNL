# Test Plan

## Goals
- Validate correctness of Boolean IR and simplification.
- Validate solver integration for XOR and CNF.
- Provide developer tests for essential, complex logic.

## Developer Tests (preferred)
1) IR and Hash-Consing
   - Creating identical XOR/AND returns same node id.
   - Canonical ordering of commutative inputs.

2) Simplification Rules
   - XOR(x, x) -> CONST0
   - XOR(x, 0) -> x
   - AND(x, 1) -> x
   - AND(x, 0) -> CONST0

3) Prove/Disprove
   - T = {x AND y = 1}, prove(x) should be DISPROVED with model.
   - T = {x AND y = 1}, prove(x OR y) should be PROVED.

4) XOR Linear System
   - x XOR y XOR z = 1 with x=1, y=0 implies z=0.
   - Detect inconsistency in x XOR x = 1.

5) SAT + XOR Propagation
   - Combine AND gate with XOR equation to force model.
   - Ensure UNSAT when CNF and XOR contradict.

6) CNL Parsing and Typing
   - Parse \"for all x in D: P(x) implies Q(x)\" into AST.
   - Reject missing quantifier domain or unknown symbols.

7) CNL to UBH Compilation
   - Compile a small quantified rule into UBH constraints.
   - Ensure predicate instances map to stable wire ids.

## Optional Unit Tests
- Bitvector add/cmp (when implemented).
- Quantifier instantiation on small domains.

## Tooling
- Use node script harnesses in src/devtests.
- Keep tests deterministic; no randomness in base suite.
