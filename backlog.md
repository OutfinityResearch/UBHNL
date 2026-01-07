# UBHNL Spec Backlog (Open Items)

This backlog lists unresolved spec decisions only. All other items from the previous list
have been incorporated into the specs.

## 1) Schema Engine: Model for Non-Instantiated Elements

**Problem**
- DS-004 detects schema violations using a model from the solver, but uninstantiated elements have no corresponding wires.
- The solver cannot assign values to variables that do not exist in the circuit, yet violation detection needs those values.

**Options with Pros/Cons**
1) **Force instantiation of all domain elements used by schemas before model checking**
   - Pros: simple; deterministic; no special backend interfaces.
   - Cons: can blow up the circuit; defeats the purpose of lazy instantiation for large domains.
2) **Generate candidate instances on demand** by compiling `Body(d)` for each `d` and adding wires before checking
   - Pros: still incremental; instantiates only what is needed for checking; keeps solver model total for checked wires.
   - Cons: requires extra compilation pass per iteration; still potentially large for very large domains.
3) **Three-valued semantics** for schema checks (`true/false/unknown`)
   - Pros: avoids forced instantiation; cheap when many terms are unknown.
   - Cons: can miss violations; may lead to non-termination or delayed convergence; harder to explain.
4) **Partial models + evaluation hooks** returned by backends
   - Pros: clean lazy evaluation; allows computing `Body(d)` without fully materializing all wires.
   - Cons: requires new backend contract; increases trusted surface; complicates caching/repro.

**Decision needed**
- Choose the default strategy and document limits, determinism guarantees, and diagnostics when the strategy cannot complete.

## 2) Rule / Theorem / Axiom Semantics

**Problem**
- CNL introduces `Rule`, `Theorem`, and `Axiom` blocks but does not define their system-level semantics.
- The translator handles `Rule`/`Definition` but ignores `Theorem`/`Axiom`.

**Options with Pros/Cons**
O1) **Treat all as assertions** (metadata only)
   - Pros: simplest; no extra control flow; fits current DSL pipeline.
   - Cons: cannot express obligations/checks; theorems are indistinguishable from rules.
O2) **Treat `Theorem` as a goal/obligation** to prove at load time (optionally skippable)
   - Pros: catches inconsistencies early; supports validation workflows.
   - Cons: can be expensive; requires failure policy and caching; may block loading.
O3) **Split into assert vs check blocks** with explicit semantics in DSL
   - Pros: explicit and unambiguous; flexible (assert vs verify).
   - Cons: adds syntax and complexity; requires new API behaviors.

**Decision needed**
- Pick a semantic model and define how each block maps to DSL and session behavior (learn/query/explain).
