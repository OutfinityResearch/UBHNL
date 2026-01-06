# DS-015: GAMP Traceability (URS/FS/NFS → Specs → Tests)

## Goal
Provide a concrete traceability scheme that connects:
- user requirements (`docs/gamp/URS.md`),
- functional specification (`docs/gamp/FS.md`),
- non-functional specification (`docs/gamp/NFS.md`),
to:
- normative technical specs (`docs/specs/`),
- and acceptance tests (`docs/specs/tests/`).

This DS exists because UBHNL targets auditability and reproducibility. If the project is used in regulated contexts (GAMP-style),
traceability is not optional: every requirement must map to design and test evidence.

## Scope
In scope:
- ID scheme for URS/FS/NFS items,
- a traceability matrix,
- a maintenance policy (“how to keep it up to date”),
- minimum acceptance evidence requirements.

Out of scope:
- any specific regulatory process beyond traceability (validation plans, SOPs, etc.).

## Requirement ID scheme (normative)
All requirement statements in URS/FS/NFS must have stable IDs.

### URS IDs
Format: `URS-###` (e.g., `URS-001`).

### FS IDs
Format: `FS-###`.

### NFS IDs
Format: `NFS-<AREA>-###`, where:
- `AREA ∈ {PERF, REL, DET, MAINT, PORT}`.

Rationale:
- IDs stay stable even if wording changes,
- IDs are easy to reference from DS files, code, and test cases.

## Traceability matrix (normative)
Each requirement must map to:
- at least one normative spec (UBH-SPEC or System Spec and/or DS),
- at least one acceptance test (case list or test-plan section).

### Matrix
| Requirement | Statement (short) | Normative specs | Design specs (DS) | Tests |
|---|---|---|---|---|
| URS-001 | Represent Boolean theories as GF(2) circuits | `../UBH-SPEC.md` | `001-ir-hashcons.md`, `002-solver-xor.md` | `../tests/test-plan.md` (1–5) |
| URS-002 | Prove/refute via checkable solving | `../src/system-spec.md` | `009-sessions-query-proof.md`, `011-backends-certificates.md` | `../tests/test-plan.md` (3,10) |
| URS-003 | “Accept only with verification” policy | `../src/system-spec.md` | `011-backends-certificates.md`, `014-certificate-formats-verification.md` | `../tests/test-plan.md` (3,5,11) |
| URS-004 | Compile higher-level logics into UBH | `../src/system-spec.md` | `003-frontends-compile.md`, `007-nl-ubh-compile.md`, `010-fragments-goals.md` | `../tests/test-plan.md` (7–9) |
| URS-005 | Incremental sessions (learn/query) | `../src/system-spec.md` | `009-sessions-query-proof.md`, `012-orchestrator-planner.md` | `../tests/test-plan.md` (10) |
| URS-006 | Explainability in user vocabulary | `../src/system-spec.md` | `009-sessions-query-proof.md`, `016-error-handling-diagnostics.md` | `../tests/test-plan.md` (10,12) |
| FS-001 | Create wires and gates API | `../UBH-SPEC.md` | `001-ir-hashcons.md` | `../tests/test-plan.md` (1–2) |
| FS-002 | Add constraints API | `../UBH-SPEC.md` | `009-sessions-query-proof.md` | `../tests/test-plan.md` (2,10) |
| FS-003 | solve()/prove(phi) behavior | `../src/system-spec.md` | `002-solver-xor.md`, `011-backends-certificates.md` | `../tests/test-plan.md` (3–5) |
| FS-004 | Strict acceptance rule (no uncheckable UNSAT) | `../src/system-spec.md` | `011-backends-certificates.md`, `014-certificate-formats-verification.md` | `../tests/test-plan.md` (11) |
| FS-005 | Front-end contract (typed AST → UBH) | `../src/system-spec.md` | `005-cnl-lexicon.md`, `006-nl-pipeline.md`, `007-nl-ubh-compile.md` | `../tests/test-plan.md` (6–9) |
| FS-006 | Session functions (learn/query/explain) | `../src/system-spec.md` | `009-sessions-query-proof.md`, `016-error-handling-diagnostics.md` | `../tests/test-plan.md` (10,12) |
| NFS-PERF-001 | Hash-consing deduplicates gates | `../UBH-SPEC.md` | `001-ir-hashcons.md` | `../tests/test-plan.md` (1) |
| NFS-PERF-002 | Incremental XOR reasoning | `../UBH-SPEC.md` | `002-solver-xor.md` | `../tests/test-plan.md` (4–5) |
| NFS-REL-001 | Kernel nodes are immutable | `../UBH-SPEC.md` | `001-ir-hashcons.md` | `../tests/test-plan.md` (1–2) |
| NFS-REL-002 | Simplifications preserve satisfiability | `../UBH-SPEC.md` | `001-ir-hashcons.md` | `../tests/test-plan.md` (2) |
| NFS-DET-001 | Deterministic parsing/typing | `../src/system-spec.md` | `005-cnl-lexicon.md`, `008-dsl.md`, `016-error-handling-diagnostics.md` | `../tests/test-plan.md` (6–8) |
| NFS-MAINT-001 | Minimal kernel; extensions as modules | `../src/system-spec.md` | `010-fragments-goals.md`, `011-backends-certificates.md`, `012-orchestrator-planner.md` | `../tests/test-plan.md` (10) |
| NFS-PORT-001 | Node.js runtime; async-first API | `../src/system-spec.md` | `009-sessions-query-proof.md` | `../tests/test-plan.md` (smoke) |

Notes:
- The “Tests” column references the normative test plan; individual test cases are enumerated there.
- The matrix must be updated whenever URS/FS/NFS change.

## Maintenance policy (normative)
1) Any change to `docs/gamp/URS.md`, `docs/gamp/FS.md`, or `docs/gamp/NFS.md` must be accompanied by:
   - updating this matrix, and
   - updating at least one test reference if acceptance criteria changed.
2) New DS files must declare which requirements they implement (by ID) in a short “Traceability” section.
3) When a backend is added, its certificate expectations must be mapped to:
   - DS-011 (policy),
   - DS-014 (format),
   - tests (certificate fixtures).

## Acceptance evidence rule
A requirement is considered “covered” only if:
- there exists a normative spec that states the requirement as a contract, and
- there exists at least one test case that would fail if the contract was violated.

## References
- `../../gamp/URS.md`
- `../../gamp/FS.md`
- `../../gamp/NFS.md`
- `../src/system-spec.md`
- `../tests/test-plan.md`
