# DS-010: Fragments and Goal Kinds

## Goal
Make the system modular by:
- classifying problems into **fragments** (what logic/constraints they use), and
- classifying requests into **goal kinds** (what the user wants).

This is the contract that lets the orchestrator choose backends/tactics without hard-coding “everything is SAT”.

## Definitions (Minimal Formalism)
### Theory
A **theory** `T` is a set of statements in the system’s semantic IR (after parsing/typing/lowering).

### GoalKind
`GoalKind` is the user intent:

| GoalKind | Meaning | Typical output |
|---|---|---|
| `Satisfy` | find a model of `T` | model/witness |
| `Prove` | show `T ⊨ φ` | proof / UNSAT certificate for `T ∧ ¬φ` |
| `Refute` | find counterexample for `T ⊨ φ` | model of `T ∧ ¬φ` |
| `EnumerateModels` | enumerate models of `T` | stream of models |
| `CountModels` | compute `#models(T)` | exact/probabilistic count + certificate |
| `Optimize` | minimize/maximize objective under `T` | optimum + witness + certificate |
| `Synthesize` | construct artifact satisfying spec | program/circuit/invariant + proof |
| `Explain` | produce human explanation | proof summary / counterexample narrative |

### Problem
A **problem** is a normalized tuple:
`P = ⟨T, φ?, kind, options⟩`

Where:
- `T` is the current theory (session + loaded theories),
- `φ?` is an optional query formula (e.g., for `Prove/Refute`),
- `options` includes budgets, completeness requirements, and trust requirements.

## What Is a Fragment?
A **fragment** is a named constraint class with:
- **sorts** (types/domains),
- **operators/constraints** permitted,
- **preferred backends** (what solves it efficiently),
- **lowerings/encodings** to other fragments (sound/equisatisfiable),
- **certificate expectations** (what must be checkable).

Conceptually:
`Fragment = ⟨Sorts, Signature, Constraints, Lowerings, Certificates⟩`

## Core Fragment Catalog
This catalog is the minimum the system must model explicitly. Backends/tactics can support multiple fragments.

### Boolean / Circuit Fragments
- `Frag_UBH`:
  - sorts: `Bit`
  - constraints: UBH DAG + assertions (XOR/AND/CONST/VAR)
  - solves via SAT/XOR; checkable via model evaluation + DRAT/LRAT for UNSAT
- `Frag_SAT_CNF`:
  - sorts: `Bit`
  - constraints: CNF clauses
  - solves via CDCL SAT; checkable via DRAT/LRAT
- `Frag_XOR_LIN`:
  - sorts: `Bit`
  - constraints: linear equations over GF(2)
  - solves via Gaussian elimination; checkable by substitution

### Quantified Boolean
- `Frag_QBF`:
  - sorts: `Bit`
  - constraints: prenex QBF + CNF matrix (or circuit matrix)
  - solves via QCDCL/CEGAR; checkable via Q-resolution certificates (or expansion-based checkers)

### SMT (Selected)
- `Frag_SMT_BV` (bitvectors):
  - sorts: `BitVector[k]`
  - constraints: BV equalities, bitwise ops, add/compare, etc.
  - lowering: bit-blast → `Frag_UBH` / `Frag_SAT_CNF`
  - certificates: BV model is checkable; UNSAT via SMT proof objects or via bit-blast + SAT certificate
- `Frag_SMT_LIA` (linear integer arithmetic):
  - sorts: `Int`
  - constraints: `Ax ≤ b`, equalities, boolean structure
  - backends: SMT(LIA), ILP/MIP for pure arithmetic cores
  - certificates: infeasibility via Farkas/dual rays (when reduced to LP/MIP), SMT proof objects otherwise
- `Frag_SMT_EUF` (uninterpreted functions + equality):
  - sorts: uninterpreted + equality
  - backends: congruence closure + SAT (DPLL(T))
  - certificates: proof objects or reduction to SAT in finite instantiations

### Constraint Programming (Finite Domains)
- `Frag_CP_FD`:
  - sorts: finite domains
  - constraints: `alldifferent`, table constraints, arithmetic FD constraints
  - lowerings: to SAT/BV/UBH or keep native CP
  - certificates: witness assignment is checkable; UNSAT requires proof logs or translation + SAT certificate

### Transition Systems / Verification
- `Frag_TS`:
  - sorts: state variables (often BV/Bool)
  - constraints: init, transition, safety/liveness specs
  - tactics/backends: BMC (SAT/SMT), IC3/PDR, automata+fixpoint, games
  - certificates: inductive invariant or strategy; checkable by SAT/SMT obligations

### Horn Clauses
- `Frag_CHC` (Constrained Horn Clauses):
  - constraints: CHCs over a background theory (BV/LIA/etc.)
  - backends: CHC solvers, IC3-style for recursion, SMT-based
  - certificates: model/invariant for predicates; checkable by SMT

### Algebraic / Numeric Fragments
- `Frag_Poly_GF2`:
  - sorts: `Bit`
  - constraints: polynomial equations over GF(2) (ANF)
  - lowering: to UBH/XOR+AND; backend: Gröbner over GF(2) (optional) or SAT/XOR
  - certificates: ideal membership proofs / checked reductions
- `Frag_NRA` (non-linear real arithmetic):
  - sorts: `Real`
  - constraints: polynomial inequalities
  - backend: CAD / NLSAT / SOS
  - certificates: witness points (SAT) + algebraic certificates (UNSAT) where supported
- `Frag_MIP` (ILP/MIP):
  - sorts: `Int`, `Real`
  - constraints: linear constraints + integrality + objective
  - certificates: primal solution (SAT/opt) and dual bounds / infeasibility certificates
- `Frag_SDP_SOS`:
  - sorts: `Real`
  - constraints: semidefinite constraints, sum-of-squares
  - certificates: dual feasible solutions / SOS decompositions

### Probabilistic / Counting / KC
- `Frag_Count`:
  - constraints: boolean theories + counting objective
  - includes: `#SAT` and exact counting
  - certificates: checkable counting certificates are non-trivial; must declare whether exact/probabilistic and provide audit trail
- `Frag_WMC` (Weighted Model Counting):
  - like `Frag_Count` but with literal weights; bridges to probabilistic inference
- `Frag_KC` (Knowledge Compilation):
  - targets: BDD/ADD, d-DNNF, SDD
  - goal: compile once, answer many queries fast (`Prove`, `CountModels`, conditional probabilities)
  - certificates: equivalence of compiled representation to source (checked via SAT/UBH equivalence checks)
- `Frag_Prob`:
  - probabilistic models (factor graphs, probabilistic programs)
  - backends: exact (WMC), approximate (BP/SMC/MCMC/VI)
  - certificates: exact via WMC/KC; approximate via confidence bounds + audit metadata

### Optimization over Boolean Constraints
- `Frag_Opt`:
  - MaxSAT, PBO, OMT (SMT optimization)
  - certificates: optimum proof (lower bounds) + witness assignment

### Proof-Carrying Mathematics (HOL / Type Theory)
- `Frag_HOL` / `Frag_TypeTheory`:
  - sorts: dependent types / higher-order terms
  - constraints: typing judgments and proof obligations
  - backends: proof assistants (interactive or automated)
  - certificates: proof terms / proof objects checked by a small kernel

### Quantum / Tensor-Network Reasoning (optional)
- `Frag_QuantumTensor`:
  - sorts: tensors / complex amplitudes
  - constraints: tensor contractions, circuit equivalences
  - backends: tensor-network contraction, stabilizer methods, MBQC reductions
  - certificates: checkable equivalence reductions (often lowered to boolean fragments for checking)

## Lowering Policy (When to Compile to UBH)
UBH is the “bit-level lingua franca”, but not every fragment should be lowered eagerly.

General rule:
- If the fragment is **bit-precise and finite** (BV, finite domains, bounded TS), lowering to UBH/SAT is usually appropriate.
- If the fragment is **numeric/continuous** (NRA, SDP), keep a native backend and require checkable certificates.
- If the fragment is **quantified** (QBF, CHC), prefer native solvers + invariant/certificate checking; optionally lower bounded instances to UBH.

The orchestrator chooses the lowering based on:
- goal kind (prove vs satisfy vs count vs optimize),
- budgets,
- completeness/trust requirements.

## Fragment Detection
Given the typed semantic IR:
1) Collect required sorts and operators.
2) Determine the smallest fragment that contains them (or a product fragment).
3) Record sub-fragments:
   - e.g., `Frag_TS` with inner `Frag_SMT_BV` for transition relation.

This classification is an input to the query planner (DS-012).
