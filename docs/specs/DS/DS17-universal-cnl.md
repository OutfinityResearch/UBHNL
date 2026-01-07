# DS-017: Universal CNL Extensions (Deterministic, Typed)

## Goal
Define how UBHNL can support “universal” controlled language features (modal, temporal, domain-specific templates) **without**
turning the core CNL into an ambiguous natural-language parser.

Relationship to other specs:
- DS-005 defines the **minimal, normative CNL** for finite-domain first-order logic.
- DS-017 defines **optional extensions** that remain deterministic and typed, and that target explicit fragments (DS-010).

This DS is not required to use UBH directly. Extensions may target:
- `Frag_TS` (transition systems / temporal properties),
- `Frag_Game` (games/strategies),
- `Frag_SMT_*` (typed arithmetic/bitvectors),
- `Frag_HOL` / `Frag_TypeTheory` (proof-assistant integration),
or be lowered to `Frag_UBH` when appropriate.

## Non-negotiable principles
Any Universal CNL extension must preserve:
1) **Deterministic parsing**: no heuristic disambiguation.
2) **Explicit scope**: binders and grouping must be explicit.
3) **Typing via the lexicon**: all identifiers must resolve to known symbols and types (DS-005).
4) **Origin tracking**: every derived statement must carry an origin (DS-009).

If an extension introduces ambiguity, it must be rejected unless the user provides explicit disambiguation.

## Extension mechanism (normative)
Universal CNL is defined as:
- the DS-005 core grammar, plus
- a set of registered extension modules.

Each extension module declares:
- additional reserved keywords (to prevent collisions with vocabulary symbols),
- additional syntax patterns (with a deterministic parser),
- a lowering target (typed semantic IR + fragment id),
- error messages and recovery hints (DS-016).

## Examples (extensions as explicit operators)
The following sections illustrate the intent and expected lowering targets.

### 1) Alethic modality (necessity/possibility)
Surface forms (example):
- `It is necessary that <P>.`
- `It is possible that <P>.`

Lowering target:
- a fragment that represents modal semantics explicitly (implementation choice), e.g., `Frag_TS` (Kripke structure) or `Frag_Game`.

Acceptance rule:
- “necessary/possible” claims are accepted only with the appropriate certificate (strategy/invariant/trace), not by fiat.

### 2) Temporal logic (bounded model checking as a checkable route)
Surface forms (example):
- `Always <P>.`
- `Eventually <P>.`

Lowering target:
- `Frag_TS` plus a chosen tactic (BMC or IC3/PDR), as described in DS-010/DS-011/DS-012.

### 3) Domain templates (controlled patterns)
A domain template is a syntactic macro that expands into DS-005 core CNL or into typed semantic IR directly.

Example template:
`For all <Type> x: If <A($x)> then <B($x)>.`

Lowering:
- emits a DS-005 core CNL structure:
  - `forall $x in Type: A($x) implies B($x)`
- then follows the normal pipeline (DS-006 → DS-007/DS-004).

## Output contracts
An extension frontend must output either:
1) the DS-006 core typed logic AST (when it stays in finite-domain FOL), or
2) a richer typed semantic IR tagged with a fragment id (DS-010).

In all cases:
- the orchestrator must see a `Problem` with a fragment and goal kind,
- results must be accepted only with checkable evidence (DS-011/DS-014).

## References
- DS-005 (normative CNL)
- DS-006 (typed AST)
- DS-010/011/012 (fragments, certificates, planner)
- DS-016 (errors)

