# Test Plan

## Goals
- Validate correctness of Boolean IR and simplification.
- Validate solver integration for XOR and CNF.
- Validate deterministic parsing/typing for CNL and DSL.
- Validate session-level `learn/query` behavior, including witness queries and explainability.

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
  - front-end tests (vocabulary, CNL/DSL parse + type),
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

### 6) Vocabulary + Symbol Resolution
- Reject unknown domains, unknown predicates, wrong arity, wrong argument types.
- Reject use of reserved keywords as identifiers (unless quoted).
- Accept fixed CNL surface patterns defined in DS-005; reject unknown surface forms.

### 7) CNL Parsing and Typing
- Parse a DS-005 block quantifier into a typed AST:
  - `For any Cell c:` with an indented `If ... then ... .` body (variable uses must be `$c`).
- Parse a DS-005 conditional with conjunction and negation inside a quantifier block.
- Reject:
  - missing type in binder (e.g., `For any c:`),
  - unknown symbol: `P(unknown)`,
  - type mismatch: `proteinP(person0)` when `proteinP: Cell -> Bool`.

### 8) DSL Parsing and Typing
- Parse a typed fact statement: `@f1 proteinP c0`.
- Parse constant typing: `Vocab ... Const c0 Cell ... end`.
- Parse existential witness query as an `Exists ... graph ... end` block (DS-008/DS-018).
- Reject:
  - `IsA x UnknownType` (unknown type),
  - two `@...` tokens on one line,
  - `$` reference out of scope,
  - bare symbol not found in vocabulary,
  - predicate application with wrong arity or argument types.

### 9) CNL/DSL to UBH Compilation
- Predicate instances map to stable wire ids in the same session/kernel.
- Quantifier edge cases:
  - `ForAll` over an empty domain compiles to `CONST1` (no constraints added).
  - `Exists` over an empty domain compiles to `CONST0` (immediately falsified).

### 10) Session `learn/query` End-to-End
With a small finite domain and vocabulary:
- `learn` a rule schema, then `query` a concrete entailment; expect `PROVED` with an explanation referencing the instantiated rule.
- `learn` facts that make the theory inconsistent; `query` anything; expect `UNSAT` with an unsat explanation/core.
- `query` with an existential witness that has multiple solutions; ensure result policy is deterministic (e.g., stable witness choice, or enumeration if requested).

Concrete scenario (CNL):
1) Learn:
   ```cnl
   For any Cell c:
       If geneA($c) then proteinP($c).
   ```
2) Learn: `geneA(c0).`
3) Query (goal kind `Prove`): `proteinP(c0)`
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

### 14) Performance and Stress Gates (Initial Targets)
These are **minimum** targets for a reference development machine; adjust only with explicit decision.

- Front-end parse + typecheck: 10k CNL lines in under 1s.
- UBH compile: 100k predicate instances in under 2s.
- Kernel memory: support at least 1e6 unique wire ids without crashing.
- Simple query latency: under 200ms for a query over 1k facts and 100 rules.

### 15) Load Directive (Theory Files)
These tests validate the `load` directive in DS-005 (CNL) and DS-008 (DSL).

- Relative path resolution:
  - `load "../theories/vocab.sys2"` resolves relative to current file.
  - Vocabulary from loaded file is available in current file.
- Absolute path rejection:
  - `load "/absolute/path.sys2"` yields `E_DSL_ABSOLUTE_PATH`.
- Circular load detection:
  - A loads B, B loads A yields `E_DSL_CIRCULAR_LOAD`.
  - Error includes the cycle path for diagnostics.
- Duplicate load is idempotent:
  - Loading same file twice has no effect (no errors, no duplicates).
- Missing file:
  - `load "nonexistent.sys2"` yields appropriate file-not-found error.
- CNL to DSL translation on load:
  - `.cnl` files are translated before loading into kernel.
  - Translation errors are reported with correct file path.

### 16) Proof Blocks (DS-020)
These tests validate proof block parsing and structure.

- Parse deduction proof with Given/Apply/Derive/Therefore sections.
- Parse contradiction proof with Assume/Constraint/Contradiction/Therefore.
- Note strings are preserved in translation to DSL.
- Step numbering (optional) is accepted.
- Missing section yields parse error with helpful message.

## Tooling Notes
- Keep the base suite deterministic; no randomness in the default run.
- When a SAT backend is pluggable, run the same suite against:
  - a tiny internal solver (for small CNF), and
  - an adapter (if/when external SAT is introduced).
