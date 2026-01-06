# DS-014: Certificate Formats and Verification Protocol

## Goal
Make certificates concrete and interoperable by specifying:
- a normalized **certificate envelope** (how certificates are stored and referenced),
- the **supported certificate kinds** (SAT/SMT/QBF/TS/Opt/MIP/KC),
- how the trusted core invokes **checkers** deterministically and offline.

This DS complements DS-011, which defines *which* certificates are required.

## Principles
- **Do not trust backends**: any `UNSAT/OPTIMAL/PROVED` claim must be accepted only with checkable evidence.
- **Deterministic checking**: checkers must run offline, deterministically, and be reproducible.
- **Stable representation**: certificates must be serializable and refer to inputs by digest.
- **Separation of concerns**:
  - backends produce results,
  - the orchestrator normalizes and stores artifacts,
  - checkers validate claims.

## Terminology
- **Artifact**: a produced object needed for reuse/explain/check (e.g., KC object, invariant, proof log).
- **Certificate**: evidence that a claim is correct (e.g., DRAT, Alethe, Farkas witness).
- **Envelope**: a stable wrapper around raw certificate data, including digests and metadata.

See also:
- Wiki: `../../wiki/concepts/certificates.html`
- Wiki: `../../wiki/concepts/drat-lrat.html`
- Wiki: `../../wiki/concepts/alethe.html`
- Wiki: `../../wiki/concepts/farkas-lemma.html`
- Wiki: `../../wiki/concepts/skolem-functions.html`

## Certificate envelope (normative)
All certificates are represented as:
```json
{
  "certificateId": "cert:sha256:…",
  "kind": "DRAT" | "LRAT" | "ALETHE" | "FARKAS" | "QRES" | "SKOLEM" | "INVARIANT" | "TRACE" | "KC_EQUIV" | "BOUND_UNSAT",
  "format": "text" | "json" | "binary",
  "problemDigest": "sha256:…",
  "artifactRefs": [
    { "artifactId": "art:sha256:…", "role": "proofLog|kc|invariant|trace|model|aux", "path": "…" }
  ],
  "metadata": {
    "backendId": "…",
    "backendVersion": "…",
    "createdAt": "…",
    "notes": "optional"
  }
}
```

Rules:
- `problemDigest` is computed over the **normalized** `Problem` (DS-010) including:
  - fragment id,
  - canonicalized constraints,
  - goal kind and options that affect semantics.
- Large proofs/artifacts must be stored as artifacts and referenced via `artifactRefs`.
- Any mismatch between `problemDigest` and the checked problem is a hard verification failure.

## Artifact store (session-level)
To avoid embedding large objects inside JSON:
- artifacts are stored in a session-managed artifact store keyed by `sha256`,
- certificates refer to artifacts by digest and role.

This enables:
- caching,
- reproducibility (artifact digests are stable),
- offline verification.

## Supported certificate kinds (minimum coherent set)
This section is normative: each kind must have a stable format.

### 1) SAT UNSAT certificates: DRAT / LRAT
Applies to:
- `Frag_SAT_CNF`, `Frag_UBH` (after lowering), and any SAT-reduced obligations.

Envelope:
- `kind = "DRAT"` or `"LRAT"`,
- `artifactRefs[role="proofLog"]` points to the DRAT/LRAT text.

Checker contract:
- Input: CNF clauses + proof log.
- Output: `ok=true` iff the proof validates that the empty clause is derivable.

Reference:
- Wiki: `../../wiki/concepts/drat-lrat.html`

### 2) SAT witnesses: models
Applies to:
- `SAT` results for `Frag_UBH` / `Frag_SAT_CNF`.

Representation:
```json
{
  "kind": "MODEL",
  "assignment": { "varId": 0, "value": 0|1 }[]
}
```

Checker contract:
- Evaluate the theory deterministically (UBH eval or CNF clause eval).
- If any constraint fails, the witness is rejected.

### 3) SMT UNSAT certificates: Alethe (proof objects)
Applies to:
- `Frag_SMT_*` when using native SMT backends that produce proof objects.

Envelope:
- `kind = "ALETHE"`,
- `artifactRefs[role="proofLog"]` references an Alethe proof object (text).

Checker policy (normative):
- If UBHNL ships an Alethe checker: use it.
- Otherwise, UBHNL may invoke an **external** deterministic checker *only if*:
  - the checker binary is pinned by digest/version,
  - the invocation is offline (no network),
  - inputs and outputs are recorded in the audit log.

If neither a built-in nor a pinned external checker is available, the result is not accepted as `UNSAT` and must be treated as `UNKNOWN`.

Reference:
- Wiki: `../../wiki/concepts/alethe.html`

### 4) LIA/MIP infeasibility: Farkas certificates (dual rays)
Applies to:
- `Frag_SMT_LIA` reduced to LP/MIP, and `Frag_MIP` infeasibility.

Format (JSON, exact rationals):
```json
{
  "kind": "FARKAS",
  "constraints": [
    { "lhs": [{"var":"x0","coef":"3/1"}, ...], "rel":"<=", "rhs":"10/1" }
  ],
  "multipliers": ["y0","y1", "..."],          // each yi is a non-negative rational
  "derivedContradiction": { "lhs":"0/1", "rel":"<=", "rhs":"-1/1" }
}
```

Checker contract:
1) Validate each `yi ≥ 0`.
2) Compute the linear combination `Σ yi * (constraint_i)`.
3) Verify the resulting inequality is a contradiction (e.g., `0 ≤ -1`).

Reference:
- Wiki: `../../wiki/concepts/farkas-lemma.html`

### 5) QBF certificates: strategies (Skolem functions) and Q-resolution
Applies to:
- `Frag_QBF`.

SAT (true) certificates:
- `kind = "SKOLEM"`, represented as:
  - Boolean circuits/functions for each existential variable as a function of universals (can be encoded as UBH DAGs),
  - plus a check procedure that evaluates the QBF under all universal assignments (bounded by domain size).

UNSAT (false) certificates:
- `kind = "QRES"` (Q-resolution family), format depends on chosen proof system.

Policy:
- If the checker for the chosen QBF proof format is not available, QBF `UNSAT` must not be accepted.

Reference:
- Wiki: `../../wiki/concepts/skolem-functions.html`

### 6) Transition system certificates: traces and invariants
Applies to:
- `Frag_TS`.

Trace (counterexample):
```json
{ "kind": "TRACE", "states": [ { "s": "…" }, ... ] }
```

Invariant (proof of safety):
```json
{ "kind": "INVARIANT", "formula": "typed-semantic-ir or lowered Bool/UBH" }
```

Checker contract:
- Trace: validate `Init(s0)` and each `Trans(si, si+1)` and `¬Safe(sk)`.
- Invariant: validate the standard three obligations (see Wiki model checking page).

### 7) Optimization certificates: “optimality via bound UNSAT”
Applies to:
- `Frag_Opt`, and also MAP-style tasks derived from probabilistic weights (DS-013).

Certificate pattern:
- a witness solution for objective `k`, plus
- a checkable certificate that objective `< k` (or `> k`) is impossible.

Envelope:
- `kind = "BOUND_UNSAT"`,
- contains or references the `UNSAT` certificate for the tightened bound problem (often DRAT/LRAT or SMT proof).

### 8) Knowledge compilation equivalence: KC equivalence checks
Applies to:
- `Frag_KC` artifacts used for proving/counting/probabilistic inference.

Certificate pattern:
- equivalence proof between source theory `T` and compiled form `KC(T)`.

Minimum acceptable route:
- reduce equivalence checking to SAT/UBH and attach DRAT/LRAT proofs for both directions.

Envelope:
- `kind = "KC_EQUIV"`,
- `artifactRefs` must include the KC object, plus SAT certificates for equivalence obligations.

## Checker invocation (normative protocol)
The orchestrator must call:
```
check(problem, backendResult) -> CheckResult
```

Where:
```json
{
  "ok": true|false,
  "checkerId": "…",
  "details": "optional human-readable detail",
  "failure": { "code": "CERT_INVALID|CERT_MISSING|DIGEST_MISMATCH|UNSUPPORTED_FORMAT|INTERNAL", "data": {} }
}
```

Failure policy:
- If the backend claim requires a certificate and `check(...)` is not `ok=true`, the final status must be `UNKNOWN` (or `ERROR` if it is a system fault).

## Tests (spec-level)
The test suite must include fixtures that cover:
- DRAT/LRAT acceptance and rejection (corrupted proof),
- digest mismatch (certificate refers to a different problem),
- missing checker for Alethe/QBF proof format → treated as `UNKNOWN`,
- invariant obligation checking for `Frag_TS`.

## References
- DS-011 (policy: what certificates are required)
- DS-012 (planner: `Check` tasks)
- DS-016 (error reporting and diagnostics format)
