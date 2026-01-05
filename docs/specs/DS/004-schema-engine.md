# DS-004: Schema Engine (Lazy Instantiation)

## Goal
Avoid full grounding of quantified rules by using counterexample-driven instantiation.

## Workflow
1) Keep quantified axioms as schemas (not fully expanded).
2) Solve current instantiated set.
3) If SAT, scan for schema violations in the model.
4) Instantiate only the violating cases.
5) Repeat until fixed point or UNSAT.

## Inputs
- Finite domain descriptors
- Schema list (forall/exists or implication rules)

## Outputs
- An expanded UBH theory sufficient for current proof/query

## Rationale
Preserves compression and avoids exponential blowup.
