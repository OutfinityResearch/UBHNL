# DS-011: Backends, Certificates, and Trusted Core

## Goal
Specify how the system integrates many reasoning methods without turning the kernel into a monolith:
- backends are pluggable,
- results must be **checkable** (witnesses/certificates),
- the system has an explicit **trusted core**.

This DS is the foundation for auditability and “don’t trust the solver, verify”.

## Trusted Core (What Must Be Small)
The trusted core is the minimal set of components whose correctness the system relies on.

Minimum trusted core:
1) **UBH evaluator/checker**
   - evaluates UBH DAGs under models (SAT witness checking),
   - checks UNSAT certificates for SAT-level problems (DRAT/LRAT),
   - checks equivalence between compiled artifacts when needed (via reductions to SAT/UBH).
2) **Certificate checkers** for non-Boolean backends
   - small, deterministic validators for certificate objects (MIP duals, invariants, etc.).

Design rule:
- Backends may be complex/untrusted; acceptance requires a checkable witness/certificate or a fallback confirmation step.

## Backend Interface (System-Level)
Backends operate on a classified problem (DS-010) and return a result + artifacts.

### Backend Capabilities
Each backend declares:
- `backendId`
- `supportedFragments: FragmentId[]`
- `supportedGoalKinds: GoalKind[]`
- `certificateTypes: CertificateType[]` it can emit
- `trustLevel: "checkable" | "heuristic"` (heuristic results must be confirmed)

### Solve API (Pseudo)
```
solve(problem: Problem, budget: Budget) -> BackendResult
```

Where:
- `problem` is normalized + fragment-tagged,
- `budget` includes time/memory/iteration caps and “must be complete” flags.

### Backend Plugin Contract (Normative)
Backends are integrated as plugins with a minimal, deterministic contract:
```
BackendPlugin {
  backendId: string
  capabilities: BackendCapabilities
  solve(problem: Problem, budget: Budget, io?: BackendIO): BackendResult
  importLearned?(learned: LearnedSet): void
  exportLearned?(request: LearnedRequest): LearnedSet
  shutdown?(): void
}
```

Notes:
- `BackendCapabilities` is derived from the metadata in "Backend Capabilities".
- `BackendIO` is a thin abstraction for logs/artifacts; it must not perform network access.
- `importLearned`/`exportLearned` are optional and must be ignored if unsupported.

### Learned Constraint Exchange (Normative)
Backends may exchange learned constraints through the orchestrator to avoid duplicated work.

Canonical structures:
```
LearnedConstraint {
  fragment: FragmentId
  kind: "CNF_CLAUSE" | "XOR_EQ" | "UBH_ASSERT"
  payload: string | number[] | structured
  origin?: OriginId[]
  digest: "sha256:..."
}

LearnedSet {
  sourceBackend: string
  constraints: LearnedConstraint[]
}

LearnedRequest {
  fragment: FragmentId
  maxCount: number
  budget: Budget
}
```

Rules:
- `payload` must reference **only** symbols from the normalized `Problem` (no new symbols).
- Clauses must be canonicalized (sorted, no duplicates).
- XOR equations must be normalized (constant on RHS, variables sorted).
- The orchestrator may drop learned constraints that are redundant or exceed budgets.

### BackendResult (Normalized)
The orchestrator normalizes all backend outputs into:
```
{
  status: "SAT" | "UNSAT" | "UNKNOWN" | "OPTIMAL" | "INFEASIBLE" | "UNBOUNDED" | "ERROR",
  model?: Model,              // for SAT / OPTIMAL
  artifact?: Artifact,        // e.g. invariant, compiled KC object, synthesized program
  certificate?: Certificate,  // UNSAT proofs, optimality proofs, etc.
  core?: OriginId[],          // optional unsat core / conflict set
  stats?: Record<string, any>,
  logs?: string[]
}
```

## Certificates (Types and Checking)
A certificate is data that allows an independent checker to validate the backend claim.

### Certificate Interface
```
check(problem: Problem, result: BackendResult) -> { ok: boolean, details? }
```

### Mandatory policy
- `SAT` must include a witness model, or be convertible to a witness (e.g., counterexample trace).
- `UNSAT` must include a checkable certificate *or* the orchestrator must confirm `UNSAT` using another checkable route.
- `OPTIMAL` must include:
  - a witness solution, and
  - a lower/upper bound certificate proving optimality.

Certificate artifacts must be tied to a **canonical encoding** of the problem (normalized CNF/UBH), not raw process-local ids.

## Required Backend Catalog (with Certificates)
This section is normative: the system’s architecture must have slots for these methods, even if some are provided via adapters.

### 1) SAT (CDCL) — `Frag_SAT_CNF`
- Input: CNF (optionally with XOR side-channel).
- Output:
  - SAT: model (assignment); check by clause evaluation.
  - UNSAT: DRAT/LRAT certificate; check by DRAT/LRAT checker.

### 2) UBH SAT/XOR — `Frag_UBH` / `Frag_XOR_LIN`
- Input: UBH DAG + assertions, plus linear XOR equations.
- Output:
  - SAT: model over UBH variables; check by UBH evaluation.
  - UNSAT: may be reduced to SAT UNSAT with DRAT/LRAT (or provide XOR-aware proof objects).

### 3) SMT (DPLL(T)) — `Frag_SMT_*`
- Input: SMT constraints over one or more theories.
- Output:
  - SAT: SMT model; must be checkable by evaluation of theory atoms (or via re-checking in a trusted SMT checker).
  - UNSAT: proof object (e.g., Alethe) or a reduction certificate:
    - BV: bit-blast to SAT + DRAT/LRAT
    - LIA: Farkas certificates when reduced to LP/MIP

### 4) CP (Propagation + Search) — `Frag_CP_FD`
- SAT: variable assignment; check by evaluating all constraints.
- UNSAT: either:
  - proof log (if backend supports), or
  - translation to SAT/SMT with checkable UNSAT certificate.

### 5) QBF — `Frag_QBF`
- SAT: winning strategy / Skolem functions (check by evaluation of QBF).
- UNSAT: Q-resolution certificate (or other accepted QBF proof format).

### 6) Model Checking (BMC, Automata/Fixpoint) — `Frag_TS`
- Counterexample: trace `s0..sk`; check by transition relation evaluation.
- Proof of safety: inductive invariant `Inv(s)`:
  - check `Init ⇒ Inv`, `Inv ∧ Trans ⇒ Inv'`, and `Inv ⇒ Safe`.

### 7) IC3/PDR — `Frag_TS`
- Output: inductive invariant and/or proof trace (frames).
- Certificate: invariant (same checking obligations as above).

### 8) CEGAR — orchestrator tactic
- Output: either refined abstraction + final certificate from a backend, or `UNKNOWN` if budget exhausted.
- Certificate: comes from the final backend (e.g., invariant, DRAT, etc.).

### 9) Abstract Interpretation — `Frag_AI`
- Output: invariants (abstract states).
- Certificate: invariants + proof obligations checked by SMT/SAT.

### 9b) Proof Assistants (HOL / Type Theory) — `Frag_HOL` / `Frag_TypeTheory`
- Output: proof terms / proof scripts + fully elaborated proof objects.
- Certificate: proof object checked by a small proof kernel (trusted core).
- Integration mode:
  - interactive proofs as long-term artifacts (theory files),
  - automated discharge of subgoals via SAT/SMT backends with imported certificates.

### 10) ATP by saturation (resolution/superposition) — `Frag_FOL_Eq`
- Output: proof trace (resolution steps).
- Certificate: check proof trace in a small proof checker.

### 11) Term rewriting + completion (Knuth–Bendix) — `Frag_Eq`
- Output: convergent rewrite system + proof of equivalence (critical pair joinability).
- Certificate: check joinability / rewriting steps; optionally reduce obligations to SMT/SAT.

### 12) Gröbner bases — `Frag_Poly_GF2` / polynomial fragments
- Output: Gröbner basis and reductions.
- Certificate: verify that:
  - the basis is correct for the ideal, and
  - target polynomial reduces to 0 modulo the basis (ideal membership).

### 13) Quantifier Elimination (CAD) — `Frag_NRA`
- SAT: witness point (sample) + check original constraints.
- UNSAT: CAD decomposition certificate where supported (or reduce to trusted QE checker).

### 14) ILP/MIP (branch-and-cut) — `Frag_MIP`
- SAT/feasible: primal assignment; check all constraints.
- UNSAT/infeasible: dual ray / Farkas certificate.
- OPTIMAL: primal + dual bound certificate.

### 15) SDP + Sum-of-Squares — `Frag_SDP_SOS`
- SAT: primal witness (matrix) + check constraints numerically with rationalization if required.
- UNSAT: dual certificate / SOS decomposition.

### 16) Structural decompositions (treewidth/DP) — tactic
- Output: decomposition + solution assembled from subproblems.
- Certificate: recomposition check + sub-certificates.

### 17) Tensor/factor graphs, belief propagation — `Frag_Tensor` / `Frag_Prob`
- Exact mode: reduce to WMC/KC with checkable certificate.
- Approx mode: must return audit metadata (bounds, seeds, convergence diagnostics) and be labeled heuristic.

### 18) Hashing + approximate model counting — `Frag_HashCount` / `Frag_Count`
- Must return:
  - random seed commitments,
  - hash family description,
  - confidence parameters `(ε, δ)`.
- Labeled probabilistic; can be cross-checked by exact counting on small instances.

### 19) Symbolic execution — tactic/backends over `Frag_SMT_*`
- Output: counterexample trace (inputs) or verified safety (invariants/UNSAT cores).
- Certificate: depends on final SMT/SAT proofs or invariants.

### 20) Synthesis (SyGuS / invariant synthesis) — `GoalKind=Synthesize`
- Output: synthesized artifact (program/circuit/invariant).
- Certificate: correctness obligations checked by SAT/SMT/UBH.

### 21) ML-guided proof search / premise selection — heuristic
- Never trusted directly; must feed into a checkable backend.
- Output: guidance only (ranking, suggested lemmas).

### Additional required classes
- **#SAT / WMC** (`Frag_Count`, `Frag_WMC`): prefer KC-based certificates (d-DNNF/SDD) when exactness is required.
- **BDD/ADD / KC** (`Frag_KC`): certificate is equivalence check between original and compiled form (SAT/UBH).
- **MaxSAT / PBO / OMT** (`Frag_Opt`): certificate is witness + proof that no better solution exists (e.g., via UNSAT of tightened bounds).
- **CHC** (`Frag_CHC`): certificate is a model/invariant for predicates, checked by SMT.
- **Separation Logic / Shape** (`Frag_Sep`): certificate is a shape invariant checked by a dedicated checker (often reduced to CHC/SMT).
- **Games (parity/reachability)** (`Frag_Game`): certificate is winning strategy, checked by simulation/obligation checks.
- **Neuro-SAT / neural-symbolic**: heuristics only; must not be trusted without checking.

## Fragment × Backend × Certificate (Summary Table)
This table is intentionally compact; the full mapping belongs in the system spec.

| Fragment | Primary backend(s) | Checkable artifact |
|---|---|---|
| `Frag_UBH` | SAT+XOR | model / DRAT-LRAT |
| `Frag_SAT_CNF` | CDCL SAT | model / DRAT-LRAT |
| `Frag_QBF` | QCDCL / CEGAR | strategy / Q-resolution |
| `Frag_SMT_BV` | SMT(BV) or bit-blast | model / SAT proof |
| `Frag_TS` | BMC, IC3/PDR | trace / invariant |
| `Frag_MIP` | branch-and-cut | primal+dual cert |
| `Frag_KC` | BDD/d-DNNF | equivalence proof |
