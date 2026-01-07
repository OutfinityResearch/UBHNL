# DS-013: Probabilistic Reasoning (Frag_Prob, Frag_WMC)

## Goal
Specify how UBHNL supports probabilistic inference without expanding the trusted kernel:
- treat probability as a **front-end + backend family** (not a kernel feature),
- use **Weighted Model Counting (WMC)** and **Knowledge Compilation (KC)** as the primary *exact and checkable* path,
- allow approximate inference as **heuristic** only, with explicit audit metadata.

This DS addresses the probabilistic under-specification for `Frag_Prob` / `Frag_WMC`.

## Scope
In scope:
- finite/discrete probabilistic models,
- Weighted Model Counting (WMC) semantics and query forms,
- how probabilistic artifacts are stored in sessions,
- exact vs approximate policies, including audit metadata,
- how probabilistic tasks interact with fragments/orchestrator/certificates.

Out of scope (for the trusted core):
- continuous distributions and floating-point numerics as a source of truth,
- approximate inference methods that cannot produce checkable artifacts.

## Background (minimal math, engineer-friendly)
UBHNL’s kernel works over **Boolean constraints**. Probabilistic inference is layered on top by adding:
- a **Boolean theory** `T` that describes which worlds (assignments) are possible, and
- a **weight model** that assigns a non-negative weight to each possible world.

The *weighted model count* is:

```
W(T) = Σ_{m ∈ Models(T)} weight(m)
```

If `T` is a Boolean theory and weights encode a probabilistic model, then probabilities become ratios of weighted counts:

```
P(Q | E) = W(T ∧ E ∧ Q) / W(T ∧ E)
```

Where:
- `E` is the evidence (observations),
- `Q` is the query event.

## Canonical internal representation
Probabilistic inference is represented as a *problem over two layers*:

1) **Constraint layer**: a Boolean theory (usually `Frag_UBH` or `Frag_SAT_CNF`).
2) **Weight layer**: a weight model attached to atoms/assignments.

### Data model (conceptual)
```
Weight = Rational               // exact mode uses rationals

WeightModel =
  | LiteralWeights { w(lit): Weight }
  | FactorGraph    { variables, factors }     // lowered to LiteralWeights via compilation

ProbTask =
  | WmcCount { theory: T, evidence?: E }
  | ConditionalProb { theory: T, evidence: E, query: Q }
  | Marginal { theory: T, evidence?: E, atoms: Atom[] }
  | Map { theory: T, evidence?: E, objective: logWeight or derived score }

ProbResult =
  | Exact { value: Rational, certificate: Certificate, artifacts: Artifact[] }
  | Approx { estimate: number, interval?: [lo, hi], confidence?: (ε, δ), audit: AuditMeta }
```

Notes:
- “Rational” means an exact fraction (e.g., `3/10`). Decimal literals are interpreted as rationals (see below).
- `Map` can be reduced to `Optimize` (DS-010) by introducing an objective derived from weights.

## Weight conventions (exact mode)
UBHNL must support exact, deterministic weights for checkability.

### Allowed literal forms
In the lowered Boolean layer, weights are attached to:
- Boolean variables (or their literals),
- one-hot encodings for finite-domain variables.

### Weight normalization for probability
For a Boolean random variable `X` modeled as one UBH/SAT variable:
- weights must satisfy `w(X) ≥ 0`, `w(¬X) ≥ 0`,
- for probabilistic semantics, additionally `w(X) + w(¬X) = 1`.

UBHNL does **not** require normalization for general WMC, but:
- `Frag_Prob` (probabilistic semantics) requires normalization,
- `Frag_WMC` (generic weighted counting) does not.

### Decimal parsing rule (deterministic)
In exact mode, a decimal token such as `0.125` is parsed as the rational:
`125 / 1000` (after removing separators and using base-10 scale).

Reason: it is deterministic, exact, and requires no floating-point rounding.

## Probabilistic DSL Syntax (Sys2)
Probabilistic weights and queries are expressed directly in Sys2 DSL (DS-008).

### 1) Declaring weights (literal-weighted WMC)
Use `Weight { literal } w` to attach a weight to a **ground literal**.

Example (independent Bernoulli priors, exact rationals):
```sys2
Weight { x } 3/10
Weight { Not { x } } 7/10
Weight { y } 1/2
Weight { Not { y } } 1/2
```

Rules:
- each `literal` must refer to a Boolean atom (or its negation) in the lowered theory,
- for probabilistic semantics (`Frag_Prob`), both a literal and its negation must be assigned.

### 2) Evidence
Evidence can be expressed as:
- regular DSL facts (constraints in the theory), and/or
- a `Given { expr }` clause inside a probabilistic query block.

### 3) Probabilistic queries
Use a `ProbQuery` block:

```sys2
@q1 ProbQuery
    Ask { Q }
    Given { E }
end
```

`Given` is optional. The session normalizes this into a `ProbTask` and classifies it as `Frag_WMC` or `Frag_Prob`.

## Planner behavior (exact vs approximate)
### Options (normative)
All probabilistic queries must accept these options:
- `requireExact: boolean` (default `true` for `Frag_Prob` unless explicitly overridden),
- `allowApprox: boolean` (default `false`),
- `budget: Budget` (DS-012),
- `confidence?: { epsilon, delta }` (only meaningful for approximate methods),
- `audit: { recordSeeds: boolean }` (default `true`).

### Exact route (preferred, checkable)
Exact inference must follow a checkable path.

Recommended plan skeleton:
```
Lower(to Bool theory T + WeightModel)
  └─► CompileKC(d-DNNF / SDD)
        └─► Check(Equivalence(T, KC))
              └─► Evaluate(WMC on KC)   // deterministic DP over the compiled object
                    └─► Explain(origins + computation summary)
```

Acceptance rule:
- If equivalence is not checked, the result is **not accepted** as exact.

### Approximate route (heuristic, auditable)
Approximate inference is allowed only when `allowApprox=true`.

Requirements for acceptance as “approximate”:
- result must be labeled heuristic,
- audit metadata must include:
  - algorithm identifier and configuration,
  - random seeds (or commitments) and iteration counts,
  - convergence diagnostics / bounds when available.

If audit metadata is missing, return `UNKNOWN`.

## Certificates and checkability
Probabilistic results are accepted only under one of these regimes:

### A) Exact + checkable
Accepted when:
- the compiled object is proven equivalent to `T` (KC equivalence check), and
- the WMC evaluation on the compiled object is deterministic and reproducible.

This is the recommended certificate pattern:
- `CertificateKind = KC_EQUIVALENCE` + references to the equivalence checks.

### B) Approximate + auditable
Accepted only as approximate results, never as “PROVED/UNSAT” facts.

For exact requests (`requireExact=true`):
- approximate methods are not sufficient → return `UNKNOWN`.

See also:
- DS-011 (backend slots + policy),
- DS-014 (certificate envelopes + checking protocol).

## Session integration (short-term memory)
The session must store probabilistic model metadata separately from Boolean constraints:
- constraints remain in the normal theory store (DS-009),
- weights/factors are stored as `ProbModel` objects with origins.

Rationale:
- weights are not logical constraints; mixing them into UBH breaks the “kernel is Boolean” rule,
- probabilistic tasks need additional audit metadata.

## Tests (spec-level, normative cases)
These cases must be representable in the DSL/CNL front-end and must round-trip to a `ProbTask`.

### Case 1: Simple WMC (independent variables)
Theory: no constraints. Variables: `x`, `y` with:
- `P(x)=3/10`, `P(y)=1/2` independent.

Expected:
- `W(T)=1` (normalized),
- `P(x)=3/10`.

### Case 2: Evidence
Evidence: `x=true`.
Expected:
- `P(x | x)=1`,
- `P(y | x)=1/2`.

### Case 3: Exact vs approximate policy
If `requireExact=true` and only an approximate backend is available:
- result must be `UNKNOWN`.

## References
- DS-010 fragments: `Frag_WMC`, `Frag_Prob`, `Frag_KC`
- DS-011 certificates policy
- DS-012 planner tactics (`CompileKC`)
- Wiki: `../../wiki/concepts/counting.html`, `../../wiki/concepts/kc.html`, `../../wiki/concepts/probabilistic.html`
- External: https://en.wikipedia.org/wiki/Weighted_model_counting
