# Test Plan

## Goals
- Validate correctness of Boolean IR and simplification.
- Validate solver integration for XOR and CNF.
- Validate deterministic parsing/typing for CNL and DSL.
- Validate session-level `learn/query` behavior, including holes (`?`) and explainability.

## Scope
- This plan is written against the specs in `docs/specs/` and is intentionally independent of any particular SAT backend.
- The base suite must stay deterministic and run offline.
- Canonical input case lists:
  - CNL: `docs/specs/tests/cnl-cases.md`
  - DSL: `docs/specs/tests/dsl-cases.md`
  - Probabilistic: `docs/specs/tests/probabilistic-cases.md`
  - Certificates: `docs/specs/tests/certificate-cases.md`
  - Errors: `docs/specs/tests/error-cases.md`

## Execution Model
- Primary harness: `npm run devtest` (Node scripts under `src/devtests/`).
- Tests are organized as:
  - kernel/IR unit tests (fast, no solver required),
  - solver integration tests (CNF + XOR),
  - front-end tests (lexicon, CNL/DSL parse + type),
  - end-to-end scenarios (learn/query, proof/counterexample rendering).

## Developer Tests (preferred)
### 1) IR and Hash-Consing
- Creating identical `xor/and` returns the same node id.
- Canonical ordering of commutative inputs (`xor(a,b)` == `xor(b,a)`, same for `and`).
- `var("x")` is stable within a kernel instance: repeated calls return the same id.

### 2) Simplification Rules (At Construction Time)
- `xor(x, x)` → `CONST0`
- `xor(x, CONST0)` → `x`
- `and(x, CONST1)` → `x`
- `and(x, CONST0)` → `CONST0`
- `and(x, x)` → `x`

### 3) Prove/Disprove Semantics
Given `prove(phi)` defined as `solve(T ∧ ¬phi)`:
- With `T = { assert1(and(x,y)) }`, `prove(x)` must be `PROVED`.
- With `T = { assert1(and(x,y)) }`, `prove(xor(x,y))` must be `DISPROVED` with a model where `x=1, y=1, xor(x,y)=0`.
- With `T = {}` (empty theory), `prove(x)` must be `DISPROVED` (model exists where `x=0`).

### 4) XOR Linear System (Pure)
- `x ⊕ y ⊕ z = 1` with `x=1`, `y=0` implies `z=0`.
- Detect inconsistency in `x ⊕ x = 1`.
- Detect inconsistency in `x = 0` and `x = 1` (two unit XOR equations).

### 5) SAT + XOR Propagation (Mixed)
- Combine one `and` gate with XOR equations to force a value.
  - Example: `z = and(x,y)`, `x=1`, `z=1` forces `y=1`.
- Ensure `UNSAT` when CNF and XOR contradict.
  - Example: `z = and(x,y)`, `z=1`, `x=0` is `UNSAT`.

### 6) Lexicon + Symbol Resolution
- Reject unknown domains, unknown predicates, wrong arity, wrong argument types.
- Reject use of reserved keywords as identifiers (unless quoted).
- Accept aliases/surface forms if declared in the lexicon (see DS-005).

### 7) CNL Parsing and Typing
- Parse: `for all x in Cell: P(x) implies Q(x)` into a typed AST.
- Parse: `for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)` (keywords + punctuation variants).
- Reject:
  - missing domain: `for all x: P(x)`,
  - unknown symbol: `P(unknown)`,
  - type mismatch: `proteinP(person0)` when `proteinP: Cell -> Bool`.

### 8) DSL Parsing and Typing
- Parse fact statement: `@c0 proteinP` as `proteinP(c0)` (subject-first, arity=1).
- Parse: `@a:Cell` (exported entity declaration).
- Parse query holes with binder: `exists ?c in Cell: proteinP(?c)`.
- Reject:
  - `@x:UnknownType`,
  - two `@...` tokens on one line,
  - `$` reference out of scope,
  - bare symbol not found in vocabulary,
  - predicate application with wrong arity or argument types.

### 9) CNL/DSL to UBH Compilation
- Predicate instances map to stable wire ids in the same session/kernel.
- Quantifier edge cases:
  - `forall x in Empty: ...` compiles to `CONST1` (no constraints added).
  - `exists x in Empty: ...` compiles to `CONST0` (immediately falsified).

### 10) Session `learn/query` End-to-End
With a small finite domain and lexicon:
- `learn` a rule schema, then `query` a concrete entailment; expect `PROVED` with an explanation referencing the instantiated rule.
- `learn` facts that make the theory inconsistent; `query` anything; expect `UNSAT` with an unsat explanation/core.
- `query` with a hole `?x` that has multiple solutions; ensure result policy is deterministic (e.g., first model, or all models if requested).

Concrete scenario (CNL):
1) Learn: `for all cell c: geneA(c) implies proteinP(c)`
2) Learn: `geneA(c0)`
3) Query: `proteinP(c0)`
Expected: `PROVED` and explanation mentions both learned statements (or their origins).

### 11) Certificate Envelopes and Verification
These tests validate DS-014 at the orchestration/checking boundary.

- Reject certificate when `problemDigest` does not match the normalized problem (`E_CERT_DIGEST_MISMATCH`).
- Reject certificate when the format is unsupported by available checkers (`E_CERT_UNSUPPORTED_FORMAT`).
- DRAT/LRAT:
  - accept a valid UNSAT proof log for a tiny CNF,
  - reject a corrupted log deterministically.
- TS invariants:
  - accept when all three obligations hold,
  - reject when any obligation fails (with origin references).

### 12) Error Handling and Diagnostics
These tests validate DS-016 error taxonomy, blame, and origin reporting.

- DSL: two `@` tokens on one line yields `E_DSL_TWO_AT` with correct `Origin` (path/line/column).
- DSL/CNL: unknown bare symbol yields `E_UNKNOWN_SYMBOL` (strict vocabulary).
- Typing: wrong arity yields `E_ARITY_MISMATCH`; wrong sort yields `E_TYPE_MISMATCH`.
- Certificate checking failures yield `CertificateError` with stable `problemDigest`.

### 13) Probabilistic (WMC/KC) and Audit Policy
These tests validate DS-013 and the exact-vs-approx policy.

- Exact WMC (small):
  - parse weights as rationals deterministically,
  - compute `P(Q|E)` as a rational ratio (when using the KC exact route).
- Policy:
  - if `requireExact=true` and no checkable exact route is available, return `UNKNOWN`,
  - if `allowApprox=true`, return an approximate estimate with audit metadata (seeds, parameters).

## Tooling Notes
- Keep the base suite deterministic; no randomness in the default run.
- When a SAT backend is pluggable, run the same suite against:
  - a tiny internal solver (for small CNF), and
  - an adapter (if/when external SAT is introduced).
