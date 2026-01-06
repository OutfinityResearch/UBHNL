# DS-004: Schema Engine (Lazy Instantiation)

## Goal
Avoid full grounding of quantified rules by using counterexample-driven instantiation (CEGAR-style).

The schema engine lives *above* the UBH kernel: it generates UBH constraints on demand, driven by solver models.

## What Is a “Schema”?
A **schema** is a quantified logical statement over a finite domain that is *not expanded upfront*.

Typical forms:
- Universal axiom: `forall x in D: Body(x)`
- Universal rule: `forall x in D: Premise(x) -> Conclusion(x)`
- Nested universals: `forall x in D: forall y in E: Body(x,y)`

The schema engine focuses primarily on **universal schemas** because they admit a clean “violation → instance” loop.

## Core Workflow (Universal Schemas)
1) Keep universal axioms as schemas (not fully expanded).
2) Solve the current instantiated UBH theory.
3) If `UNSAT`: stop (the whole theory is unsatisfiable).
4) If `SAT`: scan for schema violations in the model:
   - find assignments to quantified variables that make the schema body false.
5) Instantiate only the violating cases (add those instances as concrete UBH constraints).
6) Repeat until:
   - no violations are found (fixed point), or
   - `UNSAT`.

At fixed point, the model satisfies all schemas (relative to the current finite domains).

## Inputs
- Finite domain descriptors
- Schema list (primarily `forall`, optionally `exists`—see below)
- A model from the UBH solver (`Map<wireId,0|1>`)

## Outputs
- An expanded UBH theory sufficient for current proof/query

## Detecting Violations
Given a model `M`, a universal schema `forall x in D: Body(x)` is violated iff:
- there exists some `d ∈ D` such that `Body(d)` evaluates to `0` under `M`.

Practically:
- `Body(d)` is compiled to a UBH wire id `w`.
- A violation is detected when `M[w] = 0`.

Model requirement:
- The solver must provide a total assignment for all wires that appear in instantiated bodies, so violation checks are deterministic.

For implication rules `Premise -> Conclusion`:
- evaluate `Premise(d)` and `Conclusion(d)` under `M`;
- violation when `Premise(d)=1` and `Conclusion(d)=0`.

## Instantiation Policy
When violations exist, the engine must decide what to instantiate:
- **minimal**: instantiate just one violating assignment per iteration (keeps theory small, more iterations).
- **batch**: instantiate all currently violating assignments (fewer iterations, larger jumps).

Default policy: batch per schema up to a configurable limit (e.g., 100 instances/iteration).

Instances must be deduplicated by a canonical key (schemaId + concrete arguments).

## Nested Quantifiers
Nested universals can be treated as:
- a single schema over the Cartesian product `D×E` (conceptually), or
- a staged instantiation:
  - choose `x` first, then search for violating `y`.

Implementation note: staged scanning is typically more memory-friendly, but both are equivalent for finite domains.

## Exists (Handling Options)
`exists x in D: Body(x)` is different: it is violated when **all** instances are false.

Options:
1) **Finite expansion** (small domains): compile `∨_{d∈D} Body(d)` directly (see DS-003).
2) **Witness search via holes (preferred for large domains)**:
   - rephrase queries as “find `?x` such that `Body(?x)` holds” (DS-009),
   - the engine/search strategy enumerates candidates until it finds a satisfying witness or exhausts the domain.
3) **Lazy disjunction growth** (advanced):
   - start with a small subset `D0 ⊂ D`,
   - compile `∨_{d∈D0} Body(d)`,
   - if UNSAT, expand `D0` and retry.

The orchestrator may choose (1), (2), or (3) depending on domain size and goal kind (prove vs satisfy).

## Edge Cases (Must Be Specified)
- Empty domain:
  - `forall x in ∅: Body(x)` is `true` (no instances).
  - `exists x in ∅: Body(x)` is `false` (no witnesses).
- Domain changes:
  - if domains are mutable at the session layer, schema instances must be invalidated or versioned.
  - domains must be treated as immutable during a single `solve/query` cycle.

## Example (Biology Rule)
Schema:
`forall c in Cell: (geneA(c) and not inhibitor(c)) -> proteinP(c)`

Assume `Cell = {c0, c1}` and a model sets:
- `geneA(c0)=1`, `inhibitor(c0)=0`, `proteinP(c0)=0`

Then `Premise(c0)=1` and `Conclusion(c0)=0`, so the schema is violated at `c0`.
The engine instantiates the concrete rule for `c0` and adds the corresponding UBH constraint.

## Rationale
Preserves compression by keeping knowledge as rules/schemas, not as a fully grounded table.
