# UBHNL Specs Review (`docs/specs/`)

Date: 2026-01-06

## Scope

This review:
- reads all Markdown files under `docs/specs/` recursively, and
- incorporates + re-validates the findings from the previous `specs_review_gemini.md` review (now superseded by this file).

Repository state notes used for validation:
- The repository contains wiki concept pages under `docs/wiki/concepts/` (HTML).
- The current implementation footprint is minimal; `src/cnlTranslator/index.mjs` strongly suggests the DSL dialect intended today is the DS-008/DS-018 “Sys2” (PascalCase keywords, `__Atom`, `ForAll ... graph ... end`).

---

## Key Findings (High Impact)

1) **Two incompatible DSL dialects are described across the specs**.
2) **Many specs still reference removed/renamed files** (notably `docs/specs/UBH-SPEC.md` and pre-`DS##-` filenames).
3) **The lexicon schema is inconsistent between DS-005 and the test fixtures**.
4) **The normative test fixtures (CNL/DSL/error cases) target a different syntax than DS-008/DS-018**.
5) **Advanced-feature specs (probabilistic, holes, queries) use “DSL surface” examples that violate DS-008’s grammar rules**.

---

## Problems, Inconsistencies, and Risks

### A) DSL is not single-source-of-truth (blocking)

There are two different DSL designs presented as if both are authoritative:

- **Sys2 DSL (DS-008 + DS-018 + `docs/specs/DECISIONS.md`)**
  - PascalCase keywords (`ForAll`, `Exists`, `And`, `Or`, `Not`, `Implies`)
  - `@Name __Atom` declarations + `IsA` typing
  - quantifier blocks: `@rule ForAll Type graph x ... return $expr end`
  - **forbids** `()` and `[]`; braces `{ }` for grouping
  - (in practice, DS-018 examples commonly use bare constants like `Alice`, and `$x` only for bound variables)

- **Alternate DSL (DS-019 + DS-016 + `docs/specs/src/system-spec.md` + DS-009 + test fixtures)**
  - lowercase keywords (`forall`, `exists`, `and`, `or`, `implies`)
  - subject-first facts like `@c0 proteinP` and declarations like `@ion:Person`
  - holes via `?x` and query forms like `exists ?c in Cell: ...`
  - uses parentheses/function-call notation (`geneA(c)`), which DS-008 explicitly forbids

**Risk**: implementing parsers, translators, and devtests is ambiguous until one dialect is chosen and the rest of the docs updated or clearly labeled as pseudo-syntax.

### B) Holes / query syntax conflicts with DS-008 (blocking)

- DS-009, DS-016, DS-019, and multiple test fixtures specify `?` holes and `exists ?x ...` as *DSL* features.
- DS-008 does not define the `?` token nor an `exists ?x ...` statement shape (and forbids `()` which those examples often use).

**Risk**: session/query functionality (witness selection, hole typing, deterministic choice rules) cannot be implemented consistently without a single normative grammar.

### C) Keyword casing + reserved words are contradictory

- DS-008 and DS-018: DSL keywords are PascalCase.
- DS-019: DSL keywords are “case-sensitive (lowercase)” and maps CNL → DSL using lowercase forms.

**Risk**: lexing and reserved-word validation cannot be implemented deterministically if the keyword set is not stable.

### D) Constant/reference conventions are unclear inside the Sys2 DSL

Within the Sys2 dialect, the docs disagree on whether constants should be referenced as bare identifiers (`Alice`) or as `$Alice`:
- DS-008 states “After declaration, always reference with `$`”, but DS-018 examples use bare constants.

**Risk**: this affects strict vocabulary rules, symbol table construction, and whether the lexicon is a “source of constants” or only “type signatures + aliases”.

### E) Lexicon JSON schema is not consistent across specs/tests (blocking for front-ends)

- DS-005 defines a schema with `domains` (Type → list of constants), `predicates`, `cnlAliases`, etc.
- `docs/specs/tests/cnl-cases.md` uses a different schema (`constants` map and `aliases` instead of `cnlAliases`).
- DS-006 refers to `L.constants` even though DS-005’s schema does not define that field.

**Risk**: CNL typing/symbol-resolution rules (and therefore determinism) are impossible to validate against a single schema.

### F) System-level examples contradict DS-008 (high confusion risk)

`docs/specs/src/system-spec.md` and DS-009 include “DSL” examples written in the alternate dialect (e.g., `@c0:Cell`, `forall $c in Cell: ...`).

**Risk**: new contributors will implement the wrong language, and tests/specs will diverge further.

### G) Probabilistic spec defines semantics, but its “DSL surface” examples violate DS-008

DS-013 is solid at the semantic/architectural level (WMC/KC, exact-vs-approx policy), but the example syntax uses:
- `@x:Bit` (colon typing),
- parentheses `(Not $x)`,
- `Query ... Target: ... end`,
- `Assert ...`,
- `Weight ...`,
none of which are in DS-008’s grammar/reserved keywords.

**Risk**: probabilistic features cannot be implemented as specified without either (1) extending DS-008/DS-019 to include these constructs, or (2) moving them out of “DSL surface” into an explicit query/config API.

### H) Error codes/diagnostic examples target the alternate DSL

DS-016’s DSL examples and error conditions include:
- lowercase `forall/exists`,
- `?` holes,
- parentheses,
which do not match DS-008.

**Risk**: implementations may produce incompatible error codes and payloads depending on which DSL they implement.

### I) Stale references / broken links (repo-wide doc quality risk)

`docs/specs/UBH-SPEC.md` is referenced but does not exist (it was moved into DS00):
- referenced by DS-001, DS-002, DS-009, DS-015, and `docs/specs/src/implementation-plan.md`.

Many docs still reference old filenames (`docs/specs/DS/001-...`, `DS/008-dsl.md`, etc.) even though the repo uses `DS##-...` filenames.

**Risk**: readers cannot reliably follow the spec graph; traceability matrices are not actionable; doc tooling (HTML viewers) contains broken links.

### J) Traceability matrix (DS-015) is structurally correct but not actionable

The DS-015 matrix references:
- missing `../UBH-SPEC.md`, and
- old DS filenames (`001-ir-hashcons.md` instead of `DS01-ir-hashcons.md`), which do not exist.

**Risk**: the project’s GAMP story is undermined by broken trace links.

---

## Cross-check vs the Previous Gemini Review

Items from the previous review and their status *in the repo today*:

- **Missing wiki concept pages (Alethe, Farkas lemma, bit-blasting, Skolem functions, SyGuS)**: **resolved** (present under `docs/wiki/concepts/` as HTML pages).
- **Schema engine instantiation policy ambiguity (DS-004)**: **mostly resolved** (DS-004 now specifies a normative config surface and determinism requirements).
- **“Bit vs Boolean” terminology ambiguity**: **mostly resolved** (DS00 includes an explicit note), but some documents still use inconsistent DSL-level naming conventions.
- **Probabilistic layer under-specification**: **partially resolved** (DS-013 exists and defines semantics/policy), but its DSL surface examples conflict with DS-008.
- **GAMP linkage missing from technical specs**: **partially resolved** (DS-015 exists), but its references still point to missing/old paths.
- **Certificate verification procedure unclear**: **resolved** (DS-014 specifies envelopes and checker invocation policy).
- **XOR semantics missing “mod 2”**: **resolved** (DS00 defines XOR as addition modulo 2).
- **DS-008 ambiguity around redeclarations/type inference**: **shifted** rather than resolved; DS-008 now has strict “declare once” rules, but the repo still contains a second DSL dialect that assumes a different declaration/typing model.

---

## Recommended Resolution Order (to de-risk implementation)

1) **Choose the canonical DSL dialect** (Sys2 as in DS-008/DS-018 vs the alternate dialect in DS-019/DS-016/tests) and update the rest to match (or explicitly mark non-canonical examples as pseudo-syntax).
2) **Fix stale references**:
   - either add a small `docs/specs/UBH-SPEC.md` stub that redirects to DS00, or update all references to DS00,
   - update any remaining references to pre-`DS##-` filenames.
3) **Unify the lexicon schema** (DS-005 + DS-006 + test fixtures) and regenerate/align the test cases accordingly.
4) **Define where holes/queries live** (DSL vs session/query API) and make DS-009/DS-016/DS-013 consistent with DS-008.

