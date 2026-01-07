# Implementation Plan (Docs-First → Minimal Working Stack)

This plan assumes incremental delivery: each milestone is testable and keeps the kernel minimal.

## Milestone 0 — Repo Hygiene (done)
- Specs are the source of truth (`docs/specs/`).
- Dev test harness exists (`npm run devtest`).

## Milestone 1 — Kernel IR + Hash-Consing
Specs:
- `docs/specs/DS/DS00-vision.md`
- `docs/specs/DS/DS01-ir-hashcons.md`

Deliverables:
- `src/ir/node-store.mjs` with `const0/const1/var/xor/and`.
- Canonicalization + simplification at construction time.
- Stable ids within a kernel instance.

Acceptance tests:
- IR/hash-consing tests from `docs/specs/tests/test-plan.md` section “1–2”.

## Milestone 2 — Constraint Store + Origins
Specs:
- `docs/specs/DS/DS00-vision.md` (constraints)
- `docs/specs/DS/DS09-sessions-query-proof.md` (origin ids)

Deliverables:
- `src/api/kernel.mjs` that wraps IR and stores constraints with an `origin` payload.
- `assert0/assert1/assertEq` implemented as entries in a constraint list (no solving yet).

Acceptance tests:
- constraints are stored and replayable; origins survive through compilation.

## Milestone 3 — CNF Encoding for AND
Specs:
- `docs/specs/DS/DS02-solver-xor.md` (Tseitin for AND)

Deliverables:
- `src/solver/cnf.mjs` to emit CNF clauses for AND gates.
- A solver-backend interface (pluggable).

Acceptance tests:
- AND encoding matches truth table for small circuits (exhaustive for ≤3 vars).

## Milestone 4 — XOR Linear Engine
Specs:
- `docs/specs/DS/DS02-solver-xor.md`

Deliverables:
- `src/solver/xor-linear.mjs` implementing incremental Gaussian elimination on GF(2).
- Ability to add equations and derive implied assignments / detect conflicts.

Acceptance tests:
- XOR linear system tests from `docs/specs/tests/test-plan.md` section “4”.

## Milestone 5 — Minimal SAT Backend + Mixed Propagation
Specs:
- `docs/specs/DS/DS02-solver-xor.md`

Deliverables:
- `src/solver/engine.mjs` that:
  - builds CNF from AND gates,
  - feeds linear constraints to the XOR engine (XOR gate defs + asserts),
  - runs a pluggable SAT backend (reference implementation acceptable),
  - returns `SAT/UNSAT/UNKNOWN` with:
    - a total model for `SAT`, and
    - a checkable UNSAT certificate (DRAT/LRAT) when claiming `UNSAT`.

Acceptance tests:
- mixed propagation tests from `docs/specs/tests/test-plan.md` section “5”.

Notes:
- Correctness > performance. The SAT backend is pluggable so a stronger solver can replace the reference backend.

## Milestone 6 — Vocabulary Builder + Typed Core Logic AST
Specs:
- `docs/specs/DS/DS05-cnl-lexicon.md`
- `docs/specs/DS/DS06-nl-pipeline.md`

Deliverables:
- `src/frontend/schema/vocab.mjs` (build/validate vocabulary from Sys2 schemas).
- `src/frontend/logic/ast.mjs` (typed core logic AST data types).

Acceptance tests:
- vocabulary validation + type resolution tests (test plan section “6”).

## Milestone 7 — CNL Parser (Deterministic)
Specs:
- `docs/specs/DS/DS05-cnl-lexicon.md`
- `docs/specs/DS/DS06-nl-pipeline.md`

Deliverables:
- `src/frontend/cnl/lexer.mjs`
- `src/frontend/cnl/parser.mjs`
- `src/frontend/cnl/typing.mjs`
- clear error categories with source positions.

Acceptance tests:
- CNL parsing tests (test plan section “7”).

## Milestone 8 — DSL Parser (Intermediate IR)
Specs:
- `docs/specs/DS/DS08-dsl.md`

Deliverables:
- `src/frontend/dsl/parser.mjs`
- round-trip: CNL → typed AST → DSL (pretty-print) is optional but recommended for debugging.

Acceptance tests:
- DSL parsing tests (test plan section “8”).

## Milestone 9 — Compile Typed AST to UBH
Specs:
- `docs/specs/DS/DS07-nl-ubh-compile.md`

Deliverables:
- `src/frontend/compile.mjs` that compiles typed AST → UBH nodes + assertions.
- stable predicate-instance mapping in a session (wire ids stable).

Acceptance tests:
- compilation tests (test plan section “9”).

## Milestone 10 — Schema Engine (Lazy Quantifiers)
Specs:
- `docs/specs/DS/DS04-schema-engine.md`

Deliverables:
- schema representation + instantiation loop
- integration with solving:
  - solve → check violations → add instances → repeat
- iteration limits + `UNKNOWN` status when limits hit.

Acceptance tests:
- schema example from DS-004 and end-to-end scenarios (test plan section “10”).

## Milestone 11 — Sessions + Explainability
Specs:
- `docs/specs/DS/DS09-sessions-query-proof.md`

Deliverables:
- `src/session/session.mjs` implementing:
  - `learn(...)` and `query(...)`,
  - hole encoding/decoding,
  - explanation rendering based on origins and unsat cores.

Acceptance tests:
- end-to-end learn/query scenarios including holes and counterexamples.

## Milestone 12 — CLI + Docs Wiring
Deliverables:
- `src/cli/ubh.mjs` for:
  - loading vocabulary from Sys2 schemas,
  - reading `learn` and `query` inputs,
  - printing results + explanations.

Acceptance tests:
- smoke CLI scenarios that mirror the end-to-end examples in `docs/specs/src/system-spec.md`.
