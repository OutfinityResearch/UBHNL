# Grok Review Report: Discrepancies Between Specifications and HTML Explanations

## Summary

This report details discrepancies identified between the normative specifications in `docs/specs/` (including all subdirectories) and the HTML explanation files in `docs/` (found via glob pattern `**/*.html`). The analysis was performed recursively across all relevant files.

## Key Findings

### 1. DSL Syntax Inconsistencies (Major Discrepancy)
- **Specifications (DS-008: DSL Syntax)**:
  - File extension: `.sys2`
  - Keywords: PascalCase (e.g., `ForAll`, `Exists`, `Implies`, `And`, `Or`, `Not`)
  - Quantifier syntax: `ForAll Type graph var statement* return $expr end`
  - Examples: `@rule1 ForAll Person graph p @c1 HasFever $p @c2 IsSick $p @imp Implies $c1 $c2 return $imp end`
  - No `in` keyword; uses `graph` for variable binding.
  - Facts: `@f1 Predicate arg1 arg2` (space-separated, no `@` in expressions).
  - Declarations: `@name:kbName __Atom` for persistent KB names.
- **HTML Explanations** (e.g., `docs/languages.html`, `docs/wiki/concepts/dsl.html`):
  - File extension: `.dsl` (not `.sys2`)
  - Keywords: lowercase (e.g., `forall`, `exists`, `implies`, `and`, `or`, `not`)
  - Quantifier syntax: `forall $c in Cell: expr` (uses `in`, no `graph`, no `return $expr end` block structure)
  - Examples: `forall $c in Cell: geneA($c) implies proteinP($c)` (function-call style with parentheses, which DS-008 forbids)
  - Facts: `@ion has_flu flu` (assumes undeclared `flu` is valid, but DS-008 requires strict vocabulary; syntax allows `@` in expressions, contradicting DS-008's single-`@`-per-line rule)
  - Declarations: `@ion:Person` (missing `__Atom`, syntax differs)
- **Impact**: The HTML files describe a simpler, informal DSL syntax that does not match the strict, block-structured, vocabulary-enforced DSL in DS-008. This could mislead users or developers implementing based on HTML docs. Round-trip translation (DS-018) uses DS-008 syntax, confirming HTML is outdated.
- **File References**: `docs/specs/DS/DS08-dsl.md` (spec); `docs/languages.html`, `docs/wiki/concepts/dsl.html` (explanations).

### 2. CNL Syntax and Keyword Case Inconsistencies
- **Specifications (DS-005: CNL and Lexicon)**:
  - Keywords: Capitalized (e.g., `For all`, `There exists`, `If ... then`)
  - Indentation-based scoping (Python-style, no colons for simple rules)
  - Examples: `For all Person p: If p has Flu then p has Fever.`
  - Natural patterns: `x has Fever` → `HasFever x` (no parentheses unless explicit)
  - Strict: No pronouns, no ellipsis, finite domains.
- **HTML Explanations** (e.g., `docs/wiki/concepts/cnl.html`):
  - Keywords: lowercase (e.g., `for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)`)
  - Uses parentheses in expressions (e.g., `geneA(c)`), which DS-005 allows only for explicit predicates/values.
- **Impact**: Minor case inconsistency, but HTML omits indentation details and uses explicit function calls, diverging from DS-005's natural patterns preference.
- **File References**: `docs/specs/DS/DS05-cnl-lexicon.md` (spec); `docs/wiki/concepts/cnl.html` (explanation).

### 3. Lexicon Format and Status Inconsistencies
- **Specifications (DS-005)**:
  - JSON lexicon is "LEGACY - use CNL instead."
  - Domain knowledge in `.cnl` files, not JSON.
  - Example: CNL theory files preferred over JSON.
- **HTML Explanations** (e.g., `docs/languages.html`):
  - Presents JSON as the primary lexicon format with detailed schema.
  - No mention of CNL as replacement.
- **Impact**: HTML promotes legacy JSON, contradicting DS-005's directive to use CNL for domain knowledge.
- **File References**: `docs/specs/DS/DS05-cnl-lexicon.md` (spec); `docs/languages.html` (explanation).

### 4. Proof and Explanation Formats
- **Specifications (DS-020: Proof Format)**:
  - Defines structured CNL proof formats with keywords like `Proof`, `Given:`, `Apply:`, `Derive:`, `Therefore:`.
  - Proofs are human-readable, verifiable, and tied to user vocabulary.
- **HTML Explanations** (e.g., `docs/reasoning.html`, `docs/vision.html`):
  - Mention "explain" functionality and user-vocabulary ties but do not reference structured proof formats or DS-020 keywords.
  - No examples of proof traces in CNL.
- **Impact**: Specs define normative proof structures, but HTML lacks details, potentially understating explainability features.
- **File References**: `docs/specs/DS/DS20-proof-format.md` (spec); `docs/reasoning.html`, `docs/vision.html` (explanations).

### 5. Other Minor Inconsistencies
- **File Extensions**: Specs use `.sys2` for DSL; HTML use `.dsl`.
- **Vocabulary Strictness**: HTML examples assume undeclared symbols (e.g., `flu` in facts), violating DS-008's strict vocabulary rule.
- **Session and Theory Files**: Consistent overall, but HTML occasionally use `.dsl` instead of `.sys2` (e.g., in `docs/wiki/concepts/session.html`).
- **No Contradictions in Core Concepts**: UBH kernel, fragments, backends, certificates, and orchestrator are consistently described in both specs (e.g., DS-009, DS-010) and HTML (e.g., `docs/theory/06-sessions.html`, `docs/reasoning.html`).

## Recommendations
- Update HTML explanation files to align with current specs (DS-005, DS-008, DS-018, DS-020). The HTML appear to be from an earlier prototype phase.
- Add cross-references in HTML to normative specs for clarity.
- No discrepancies found in core architecture (UBH kernel, sessions, fragments), indicating solid alignment in system design.

## Conclusion
Discrepancies exist primarily in syntax and format details, with HTML reflecting outdated or prototype versions of the DSL and CNL. Core system concepts remain consistent. Action is recommended to synchronize documentation for accuracy and usability.

Generated on: 2026-01-07