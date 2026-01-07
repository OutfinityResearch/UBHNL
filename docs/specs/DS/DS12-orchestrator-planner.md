# DS-012: Orchestrator and Query Planner

## Goal
Define how the system:
- classifies a query into fragments (DS-010),
- builds an execution plan (tactics + backends),
- runs incrementally with budgets,
- exchanges artifacts between backends (lemmas, invariants, cores),
- and returns a final, checkable result (DS-011).

The orchestrator is the “brain”; backends are specialized engines.

## Inputs / Outputs
### Input
- `SessionState` (current theory + loaded theory files + caches) (DS-009)
- `Problem` (normalized goal) (DS-010)
- `Budget` (time/memory/iteration + completeness policy)

### Output
- `QueryResult` with:
  - normalized status,
  - witness/certificate (or confirmation failure),
  - explanation payload (origins, minimal core, trace).

## Planner: From Problem to Plan
The planner produces a **plan DAG** of tasks.

### Plan DAG
Each node is:
`Task = ⟨taskId, kind, fragment, inputs, budget, outputs, deps⟩`

Common task kinds:
- `Lower`: compile semantic IR to a target fragment (e.g., BV → UBH).
- `Solve`: call a backend on a fragment.
- `Check`: run a certificate checker.
- `Refine`: CEGAR refinement step (add instances/lemmas/invariants).
- `CompileKC`: compile to knowledge representation (BDD/d-DNNF).
- `Explain`: produce a human explanation from artifacts.

### Planner Steps (Deterministic)
1) **Fragment detection**: classify `Problem` into dominant + subfragments (DS-010).
2) **Strategy selection**: choose a tactic pipeline based on:
   - `GoalKind`,
   - fragment,
   - trust requirements (must be checkable),
   - expected cost (heuristic).
3) **Lowering decision**:
   - decide what to compile to UBH/SAT and what to keep native.
4) **Backend selection**:
   - choose one or more candidate backends per task.
5) **Budget partitioning**:
   - allocate budgets across tasks; define timeouts.

### Planner Heuristics (Default Rules)
The planner uses deterministic heuristics with explicit thresholds (configurable):

- **XOR density**: if XOR constraints are >= 30% of Boolean constraints, prefer XOR-aware backends.
- **Quantifiers**: if any quantifier domain size exceeds `N=200`, use CEGAR (schema engine); otherwise expand.
- **Bit-vectors**: if max width <= 32 and total BV atoms <= 50k, prefer bit-blast to UBH; otherwise use SMT(BV).
- **Probabilistic**: if `requireExact=true` and variable count <= 150, prefer KC; otherwise return `UNKNOWN` or use approximate mode with audit metadata.
- **Parallel race**: if two backends are both checkable and cheap, run them in parallel with split budgets and accept the first checkable result.

All heuristic choices must be recorded in the plan metadata for reproducibility.

## Tactics (Reusable Pipelines)
Tactics are higher-order procedures that build plans.

### Tactic: Direct Solve
Use when the fragment has a strong native backend.
Pipeline:
`Solve(fragment) → Check(certificate) → Explain`

### Tactic: Lower-to-UBH
Use when the fragment can be bit-blasted or finitely encoded.
Pipeline:
`Lower(to UBH) → Solve(UBH/SAT) → Check(DRAT/LRAT or model) → Explain`

### Tactic: CEGAR (Abstraction/Refinement)
Use when quantifiers/large domains/TS verification require lazy growth.
Pipeline (loop):
`Solve(abstraction) → if SAT: find counterexample/violation → Refine → repeat`

Artifacts exchanged:
- counterexample traces,
- violated schema instances,
- new lemmas,
- candidate invariants.

Requirement:
- Backends used in schema-based CEGAR must provide an evaluation hook (DS-011).
- If no backend supports evaluation hooks for the fragment, return `UNKNOWN` with reason `SCHEMA_EVAL_UNSUPPORTED` (DS-016).

### Tactic: IC3/PDR for Safety
Applicable for `Frag_TS` safety properties.
Pipeline:
`Solve(IC3/PDR) → Check(invariant) → Explain`

Fallback:
- if PDR fails/budget exceeded: bounded model checking (`Lower-to-UBH`).

### Tactic: Knowledge Compilation (KC)
Applicable when many queries will be asked over the same theory:
Pipeline:
`CompileKC(d-DNNF/BDD) → Check(equivalence) → AnswerQueriesFast`

### Tactic: Optimize via Bound Tightening
Applicable for `Frag_Opt` (MaxSAT/PBO/OMT):
Pipeline:
`Solve(bound k) → if SAT: improve bound → if UNSAT: prove optimality via UNSAT certificate`

## Cross-Backend Communication Objects
Backends exchange structured information; the orchestrator routes it.

Minimum shared objects:
- `Lemma`: a derived constraint to add to the theory (with origin).
- `UnsatCore`: set of origins that caused conflict.
- `Interpolant`: formula `I` separating `A` and `B` (optional).
- `Invariant`: inductive invariant for TS/CHC.
- `Strategy`: winning strategy for games/QBF (optional).
- `LearnedConstraintSet`: exchangeable constraints/clauses (DS-011).

All objects must be:
- serializable,
- typed,
- tied to origins for explainability.

### Learned Constraint Exchange (Protocol)
The orchestrator may request and distribute learned constraints at plan checkpoints:
- after each `Solve` task finishes,
- after each `Refine` step in CEGAR,
- before re-running a backend with a refined theory.

Rules:
- Learned constraints are **optional** inputs; backends must remain sound without them.
- The orchestrator must respect fragment compatibility (do not send CNF clauses to an SMT backend).
- Imported constraints must be logged with origins for explainability.

## Incrementality, Caching, Reproducibility
### Incremental sessions
The orchestrator must support:
- incremental addition of statements (`learn`),
- repeated queries without recomputing everything,
- incremental solver APIs where available.

### Caching
Cache keys should include:
- normalized semantic IR hash,
- fragment id + lowering options,
- backend id + configuration,
- random seeds (for probabilistic methods).

### Reproducibility
For any `QueryResult`, store enough metadata to replay:
- exact inputs (theory file digests + session deltas),
- selected plan,
- backend configs,
- random seeds and budgets.

## Failure / Unknown Handling
The orchestrator may return `UNKNOWN` when:
- budgets exhausted,
- backend lacks certificate,
- probabilistic method used with insufficient confidence.

Rule:
- `UNKNOWN` is always preferable to an uncheckable `UNSAT/OPTIMAL` claim.

## End-to-End Example Plans (Sketch)
### Example 1: Propositional SAT (UBH native)
Goal: prove `T ⊨ φ`.
Plan:
1) `Lower(to UBH)` (if not already UBH)
2) `Solve(UBH)` on `T ∧ ¬φ`
3) `Check(DRAT/LRAT)` if UNSAT or `Check(model)` if SAT
4) `Explain(core/model)`

### Example 2: SMT(BV)
Goal: satisfy BV constraints.
Plan (two alternatives):
- A) `Solve(SMT_BV) → Check(model)` or check UNSAT via proof
- B) `Lower(bit-blast → UBH) → Solve(SAT) → Check(DRAT/LRAT)`

The planner chooses based on size, expected structure, and trust availability.

### Example 3: TS Safety (IC3/PDR with fallback)
Goal: prove safety.
Plan:
1) `Solve(IC3/PDR)`
2) if success: `Check(invariant)` and return PROVED
3) else: `Lower(BMC to UBH)` at increasing bounds until SAT counterexample or budget end
