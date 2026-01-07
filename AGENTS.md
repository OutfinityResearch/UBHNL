# Agent Guidelines for UBHNL

## Language policy (repo-wide)
- Chat responses may be in Romanian.
- Repository artifacts (code, comments, docs, specs, site pages) must be written in **English**.
- Exception: temporary review notes placed at the repo root (when explicitly requested) may be in Romanian.
- Do not use git commands.

---

## Quick Reference: Where to Find What

### Specifications (normative)
| Spec | Location | Purpose |
|------|----------|---------|
| **DS00** | `docs/specs/DS/DS00-vision.md` | Vision, architecture, system diagram |
| **DS01** | `docs/specs/DS/DS01-ir-hashcons.md` | UBH kernel, wire/gate storage |
| **DS02** | `docs/specs/DS/DS02-solver-xor.md` | SAT+XOR solving strategy |
| **DS05** | `docs/specs/DS/DS05-cnl-lexicon.md` | CNL syntax, natural patterns |
| **DS08** | `docs/specs/DS/DS08-dsl.md` | DSL syntax (.sys2 format) |
| **DS18** | `docs/specs/DS/DS18-cnl-translator.md` | CNL↔DSL translation rules |
| **DS20** | `docs/specs/DS/DS20-proof-format.md` | Proof trace format |

### Decisions & Conventions
| Document | Location | Purpose |
|----------|----------|---------|
| **DECISIONS.md** | `docs/specs/DECISIONS.md` | All confirmed design decisions |
| **AGENTS.md** | `AGENTS.md` (this file) | Agent guidelines, spec map |

### Decision Logging
- Record all explicit, important decisions in `docs/specs/DECISIONS.md`.

### Code & Tests
| Folder | Purpose |
|--------|---------|
| `/src/cnlTranslator/` | CNL → DSL translator |
| `/evals/fastEval/` | 14 test suites (source.cnl + expected.sys2) |
| `/theories/` | Reusable domain theories in CNL |

---

## DSL (Intermediate Representation) Restrictions

The DSL is a deterministic, typed, strict-vocabulary language used for long-term theory files and reproducible learn/query inputs.

### Core rules (must match DS-008)
- **`@name` for declaration**: appears once, at line start
- **`$name` for reference**: inside expressions
- **`{ }` for grouping**: NOT parentheses
- **Strict vocabulary**: any bare identifier must exist in the vocabulary (lexicon + exported declarations), otherwise it is a load error.

### Working Memory vs KB Names
- **Working memory**: `@tmp __Atom` or `@tmp expr` defines a temporary name; reference it as `$tmp`.
- **Persistent KB**: `@tmp:kbName __Atom` or `@tmp:kbName expr` stores a stable vocabulary name; reference it as `kbName` (bare).
- **Explainability**: prefer `:kbName` for important facts, lemmas, theorems so proofs/explanations stay compact and readable.

### Human-readable names
Use `@varName:humanName` when internal ID differs from display name:
```sys2
@c1:AliceHasFever HasFever Alice
```

If a theory needs explicit DAG construction (for debugging or reuse), use named intermediates, but keep the one-@ rule.

---

## CNL (Controlled Natural Language) Guidelines

1. **Natural patterns**: Use SVO (Subject-Verb-Object) without parentheses
   - `Alice trusts Bob.` not `Trusts(Alice, Bob)`
   - `p1 has Fever.` not `HasFever(p1)`

2. **Map to DAG**: The CNL parser reads "natural" sentences and translates to DSL

3. **Flexibility**: CNL can look like English, Math, or Logic, but it must translate deterministically

4. **Python-style indentation**: 4 spaces define block scope

### Supported Natural Patterns
| Pattern | Example | DSL Output |
|---------|---------|------------|
| `X has Y` | `p1 has Fever` | `HasFever p1` |
| `X is Y` | `Socrates is Mortal` | `Mortal Socrates` |
| `X verb Y` | `Alice trusts Bob` | `Trusts Alice Bob` |
| `X is Y of Z` | `p1 is Parent of p2` | `Parent p1 p2` |

---

## Domain Knowledge: Theories (No External Schemas)

**IMPORTANT**: Domain knowledge is expressed in CNL/DSL files, not external schema formats.

| Location | Purpose |
|----------|---------|
| `/theories/core/` | Core logic primitives |
| `/theories/domains/` | Reusable domain theories |
| `/theories/domains/medical.cnl` | Patient, symptoms, diagnosis |
| `/theories/domains/family.cnl` | Person, Parent, Ancestor |
| `/theories/domains/social.cnl` | User, trusts, knows |

Example theory:
```cnl
# theories/domains/medical.cnl
Patient is a Domain.
For any Patient p:
    If p has Flu then p has Fever.
```

---

## Running Tests

```bash
node evals/runFastEval.mjs
```

Output shows:
- Translation status (✓/✗) for each suite
- Input preview
- Summary table with Trans/Reasoning/Correct/Proof columns
