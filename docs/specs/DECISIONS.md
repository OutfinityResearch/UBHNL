# Design Decisions and Assumptions

This document records all design decisions made during specification development.
Items marked with `[CONFIRMED]` have been explicitly approved.

---

## 1. Language Design

### 1.1 Case Sensitivity [CONFIRMED]

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Constant names** | Case-sensitive | `Alice` stays `Alice` everywhere |
| **Type/Domain names** | Case-sensitive | `Cell`, `Person` stay as-is |
| **Predicate names** | Case-sensitive | `HasFever`, `GeneA` stay as-is |
| **CNL keywords** | Case-insensitive | `For All` = `for all` = `FOR ALL` |
| **DSL keywords** | Case-sensitive | `ForAll` only (PascalCase) |

### 1.2 File Extensions [CONFIRMED]

| Format | Extension | Rationale |
|--------|-----------|-----------|
| CNL | `.cnl` | Distinct from DSL |
| DSL | `.sys2` | Project-specific |
| Lexicon | (derived) | Built from Sys2 schema files |
| Theory | `.cnl` or `.sys2` | Domain knowledge in `/theories/` |

### 1.2.1 No External Data Formats for Domain Knowledge [CONFIRMED 2026-01-07]

| Decision | Domain knowledge expressed in CNL/DSL, not in external data formats |
|----------|-------------------------------------------------------------|
| Rationale | Single language for all declarations |
| New way | `Person is a Domain.` + rules in `.cnl`/`.sys2` files |
| Location | `/theories/domains/` for reusable theories |

### 1.3 Translation Direction [CONFIRMED]

| Decision | Supported |
|----------|-----------|
| CNL → DSL | Yes (for storage) |
| DSL → CNL | Yes (for display/explanation) |
| Round-trip guarantee | Yes for the CNL-core subset |

### 1.4 Lexicon Source of Truth [CONFIRMED]

| Decision | Sys2 schema files (`.sys2`) are the canonical source |
|----------|------------------------------------------------------|
| Vocabulary | Derived from DSL declarations (`@name:kbName __Atom`, `IsA`, definitions) |
| CNL | Human-friendly authoring; translated into Sys2, but not authoritative for schema/metadata |

### 1.5 CNL vs DSL Architecture Rationale [CONFIRMED 2026-01-07]

This section explains **why we have two languages** and when to use each.

#### 1.5.1 The Two-Language Design

| Aspect | CNL (`.cnl`) | DSL (`.sys2`) |
|--------|--------------|---------------|
| **Purpose** | Human authoring, review by non-technical users | Machine execution, stable storage |
| **Audience** | Domain experts, business analysts | Developers, automated tools |
| **Syntax stability** | May evolve with user feedback | Frozen, backward-compatible |
| **Execution** | Translated → DSL → Kernel | Direct → Kernel |

#### 1.5.2 Loading and Execution Flow

```
┌─────────────┐      translate       ┌─────────────┐
│  .cnl file  │ ──────────────────►  │  DSL (mem)  │
└─────────────┘                      └──────┬──────┘
                                            │
┌─────────────┐      direct load            │
│ .sys2 file  │ ────────────────────────────┤
└─────────────┘                             ▼
                                     ┌─────────────┐
                                     │   Kernel    │
                                     │  (UBH IR)   │
                                     └─────────────┘
```

**Key points:**
- Both `.cnl` and `.sys2` files can be loaded via `load "path"`
- **Paths are RELATIVE** to the current file's directory (absolute paths forbidden)
- `.cnl` files are **translated to DSL** before kernel execution
- `.sys2` files are loaded **directly** (no translation step)
- The kernel only sees DSL - it is the **executable format**

**Load path examples:**
```cnl
// File: /project/cases/patient1.cnl
load "../theories/domains/medical.cnl"   // OK - relative path
load "../theories/core/logic.sys2"       // OK - can load .sys2
// load "/absolute/path/file.cnl"        // ERROR - absolute forbidden
```

#### 1.5.3 When to Use Each Format

| Use Case | Format | Rationale |
|----------|--------|-----------|
| **Domain theories** (medical, legal) | `.sys2` | Canonical, unambiguous storage |
| **Core logic primitives** | `.sys2` | Stability critical, rarely changes |
| **System configuration** | `.sys2` | Precise semantics, no ambiguity |
| **User-authored rules** | `.cnl` | Natural language for ease of use |
| **Generated output** | `.sys2` | Deterministic, tooling-friendly |
| **Proofs/explanations** | CNL (generated) | Human-readable output |

#### 1.5.4 Stability Guarantees

| Language | Stability |
|----------|-----------|
| **DSL (.sys2)** | **Frozen syntax** - backward compatible, changes require deprecation cycle |
| **CNL (.cnl)** | **Evolving** - new patterns can be added, user feedback drives changes |

**Why DSL is more stable:**
- No pattern matching ambiguity (`X has Y` vs `X verb Y`)
- Explicit IDs (`@c1`, `@rule1`) - no generation needed
- No indentation sensitivity
- No singular/plural normalization

#### 1.5.5 Extending the System

| Goal | Approach |
|------|----------|
| **New natural pattern** | Extend CNL translator, add to DS05 |
| **New kernel primitive** | Add to DSL (DS08), then add CNL sugar |
| **Domain-specific vocabulary** | Create `.cnl` theory in `/theories/domains/` |
| **Core axioms/primitives** | Create `.sys2` theory in `/theories/core/` |

#### 1.5.6 Related Specifications

| Spec | Content |
|------|---------|
| **DS05** | CNL syntax, natural patterns, `load` directive |
| **DS08** | DSL syntax, `load` directive, all primitives |
| **DS18** | CNL ↔ DSL translation rules |

---

## 2. DSL Syntax Decisions [CONFIRMED]

### 2.1 Variable Declaration

| Decision | `@` declares a variable/expression name |
|----------|----------------------------------------|
| Syntax | `@name __Atom` or `@name expression` |
| Example | `@Alice __Atom`, `@rule1 Implies $a $b` |
| Invariant | Each `@name` appears exactly once |

### 2.1.1 Human-Readable Variable Names [CONFIRMED 2026-01-07]

| Decision | `@varName:humanName` for user-friendly display |
|----------|-----------------------------------------------|
| Syntax | `@internalId:DisplayName expression` |
| Example | `@c1:AliceHasFever HasFever Alice` |
| Purpose | Internal ID for code, display name for users |
| Usage | `@c1:AliceHasFever` shows as "AliceHasFever" in explanations |
| KB Storage | Same syntax: `@var:kbName` stores in KB with that name |

### 2.2 Variable Reference

| Decision | `$` references **working-memory names** (bound variables or named expressions) |
|----------|-----------------------------------------------------------------------------|
| Syntax | `$name` |
| Example | `Implies $c1 $c2`, `HasFever $p` |
| Scope | Must be in scope (block binders or local named expressions) |
| Constants | **Bare identifiers** (e.g., `Alice`, `c0`) refer to KB/vocabulary names |
| Note | `$` names are short-lived; persist important facts with `@name:kbName` |

### 2.3 `@` Position Rule [CONFIRMED]

| Decision | `@` appears ONLY at beginning of declaration |
|----------|---------------------------------------------|
| Rationale | Prevents ambiguity, clear declaration point |
| Valid | `@f1 Trusts $alice $bob` |
| Invalid | `Trusts @alice @bob` (ERROR!) |

### 2.4 Forbidden Tokens [CONFIRMED]

| Token | Status | Reason |
|-------|--------|--------|
| `( )` | **FORBIDDEN** | Use space-separated args or `{ }` |
| `[ ]` | **FORBIDDEN** | Reserved for future use |
| `;` | **FORBIDDEN** | Newlines separate statements |

### 2.5 Anonymous Grouping [CONFIRMED]

| Decision | Use `{ }` for inline anonymous expressions |
|----------|-------------------------------------------|
| Syntax | `{ expression }` |
| Example | `Implies { And $a $b } { Or $c $d }` |

### 2.6 KB Storage [CONFIRMED]

| Syntax | Effect |
|--------|--------|
| `@name expr` | Named expression (local only) |
| `@name:kbName expr` | Named + stored in KB |
| `@:kbName` | Store previous expression in KB |

**Working memory vs KB**:
- `@tmp __Atom` or `@tmp expr` creates a **working-memory name**; reference it as `$tmp`.
- `@tmp:kbName __Atom` or `@tmp:kbName expr` creates a **stable KB name**; reference it as `kbName` (bare).
- Prefer `:kbName` for important facts, lemmas, or theorems so proofs/explanations prioritize them and reduce noise.

### 2.7 Block Syntax [CONFIRMED]

| Construct | Syntax |
|-----------|--------|
| Universal | `ForAll Type graph var ... return $expr end` |
| Existential | `Exists Type graph var ... return $expr end` |
| Definition | `@name:name graph params ... return $expr end` |

### 2.8 Comments

| Decision | DSL uses `#` for comments |
|----------|--------------------------|
| Example | `# This is a comment` |

### 2.9 Probabilistic DSL Syntax [CONFIRMED]

| Decision | Extend Sys2 DSL with explicit probabilistic constructs |
|----------|--------------------------------------------------------|
| Weight | `Weight { literal } 3/10` |
| Query | `@q ProbQuery ... end` with `Ask { expr }` and optional `Given { expr }` |
| Notes | Weight targets must be ground literals; decimals parse as exact rationals |

### 2.10 Sys2 as Schema/Metadata Carrier [CONFIRMED]

| Decision | Use Sys2 for schemas, metadata, and explanation-ready annotations |
|----------|--------------------------------------------------------------------|
| Rationale | CNL is for authoring; Sys2 is precise and stable for tooling |
| Examples | `@rule1:FluCausesFever ...`, `@lemma1:LemmaX ...` |

---

## 3. CNL Syntax Decisions [CONFIRMED]

### 3.1 Sentence Order

| Decision | Subject-Verb-Object (SVO) order |
|----------|--------------------------------|
| Rationale | Natural English grammar |
| Example | `Alice trusts Bob.` |

### 3.2 Statement Termination

| Decision | CNL uses `.` (period) to end statements |
|----------|----------------------------------------|
| Rationale | Natural English punctuation |
| Example | `Alice has Fever.` |

### 3.3 Comments

| Decision | CNL uses `//` for comments |
|----------|---------------------------|
| Rationale | Familiar to programmers, distinct from natural text |

### 3.4 Block Syntax [CONFIRMED]

| Construct | Syntax |
|-----------|--------|
| Rule | `Rule Name: body` |
| Definition | `Definition Name(params): body` |
| Theorem | `Theorem Name: Given: ... Conclude: ...` |
| Axiom | `Axiom Name: body` |
| Quantifier | `For all Type var: body` |

### 3.5 Grouping [CONFIRMED]

| Decision | CNL allows parentheses `()` for grouping |
|----------|----------------------------------------|
| Rationale | Natural in English |
| Example | `(Alice has Fever or Bob has Fever) and Charlie is sick.` |

### 3.6 Forbidden Constructs [CONFIRMED]

| Construct | Status | Reason |
|-----------|--------|--------|
| Pronouns | **FORBIDDEN** | Ambiguous reference |
| Ellipsis | **FORBIDDEN** | Incomplete sentences |
| Passive without agent | **FORBIDDEN** | Missing subject |
| Implicit quantification | **FORBIDDEN** | Use explicit `For all` |

### 3.7 Natural Predicate Patterns [CONFIRMED 2026-01-07]

CNL supports natural English patterns that translate to DSL predicates.
**No parentheses needed** for standard patterns:

| CNL Pattern | Example | DSL Output |
|-------------|---------|------------|
| `X has Y` | `p1 has Fever` | `HasFever p1` |
| `X is Y` | `Socrates is Mortal` | `Mortal Socrates` |
| `X verb Y` | `Alice trusts Bob` | `Trusts Alice Bob` |
| `X is Y of Z` | `p1 is Parent of p2` | `Parent p1 p2` |
| `X coughs` | `p1 coughs` | `Coughs p1` |

Use explicit `Pred(args)` only for:
- Nested functions: `Succ(n)`, `Next(Yellow(x))`
- Multi-arg with values: `Age(p1, 16)`

### 3.8 Python-Style Indentation [CONFIRMED 2026-01-07]

| Decision | CNL uses indentation for block scope (like Python) |
|----------|---------------------------------------------------|
| Unit | 4 spaces (tabs converted) |
| Block start | Line ending with `:` |
| Block end | Dedent to previous level |

```cnl
For any Person x:
    x has Fever.      # Inside block (4 spaces)
    x is sick.        # Also inside
x is healthy.         # Outside (no indent)
```

### 3.9 Disjunction and Biconditional [CONFIRMED 2026-01-07]

| CNL Pattern | Example | DSL Output |
|-------------|---------|------------|
| `A or B` | `p has Flu or p has Cold` | `Or { HasFlu $p } { HasCold $p }` |
| `A if and only if B` | `x is Active iff x is Running` | `Iff { Active $x } { Running $x }` |
| `A iff B` | Short form of biconditional | Same as above |

Complex expressions in ForAll blocks:
```cnl
For any Status s:
    s is Active if and only if it is not the case that s is Sleeping.
```

Generates:
```sys2
@rule1 ForAll Status graph s
    @c1 Active $s
    @c2 Sleeping $s
    @not1 Not $c2
    @iff2 Iff $c1 $not1
    return $iff2
end
```

---

## 4. Semantic Decisions [CONFIRMED]

### 4.1 Empty Domain Semantics

| Quantifier | Empty Domain Result |
|------------|---------------------|
| `ForAll x in ∅: P(x)` | `true` (vacuously) |
| `Exists x in ∅: P(x)` | `false` (no witness) |

### 4.2 Operator Precedence

| Operator | Precedence | Associativity |
|----------|------------|---------------|
| `Not` | 4 (highest) | prefix |
| `And` | 3 | left |
| `Or` | 2 | left |
| `Implies` | 1 (lowest) | right |

### 4.3 Scope Rules

| Declaration | Scope |
|-------------|-------|
| `@name __Atom` | Global (entire theory) |
| `graph varName` | Local to containing block |
| `@localExpr` inside block | Local to containing block |

---

## 5. Translation Decisions [CONFIRMED]

### 5.1 CNL → DSL Mapping

| CNL | DSL |
|-----|-----|
| `Let Alice be a Person.` | `@Alice __Atom` + `IsA Alice Person` |
| `Alice has Fever.` | `@fN HasFever Alice` |
| `For all Person p: ...` | `ForAll Person graph p ... end` |
| `If A then B.` | `Implies { A } { B }` |
| Variables: bare `p` | Variables: prefixed `$p` |
| Grouping: `(A and B)` | Grouping: `{ And A B }` |

### 5.2 Predicate Syntax

| CNL | DSL |
|-----|-----|
| Subject-Verb-Object | Predicate-Args |
| `Alice trusts Bob.` | `Trusts Alice Bob` |
| `p1 is Parent of p2.` | `Parent p1 p2` |

---

## 6. Implementation Decisions

### 6.1 Wire ID Allocation

| ID | Meaning |
|----|---------|
| 0 | CONST0 |
| 1 | CONST1 |
| 2+ | Sequential allocation for VARs and gates |

### 6.2 Schema Engine Limits

| Parameter | Default |
|-----------|---------|
| Max iterations | 100 |
| Max instances per iteration | 1000 |
| On limit | Return `UNKNOWN` with `E_SCHEMA_LIMIT` |

### 6.3 Budget Units

| Parameter | Unit |
|-----------|------|
| Time | milliseconds |
| Memory | bytes |
| Iterations | count |

### 6.4 Finite Domain Lowering (CNL/DSL) [CONFIRMED 2026-01-07]

| Decision | CNL/DSL finite domains use explicit enumeration |
|----------|-----------------------------------------------|
| Rule | Domain elements are declared constants; quantifiers enumerate or emit schemas |
| Note | No bitvector encoding is used for CNL/DSL finite domains |

### 6.5 Vocabulary Merge Policy [CONFIRMED 2026-01-07]

| Decision | No automatic namespacing; collisions are errors |
|----------|-----------------------------------------------|
| Policy | A KB name may be introduced only once across all loaded files |
| Resolution | Use explicit prefixes (e.g., `Medical_Patient`) or aliases (`@local:GlobalName`) |

### 6.6 Orchestrator Heuristics Defaults [CONFIRMED 2026-01-07]

| Heuristic | Default |
|-----------|---------|
| XOR density | Prefer XOR-aware backend if XOR >= 30% |
| Quantifiers | Use CEGAR if any domain size > 200 |
| Bit-vectors | Bit-blast if width <= 32 and BV atoms <= 50k |
| Probabilistic | Exact KC if var count <= 150 when `requireExact=true` |
| Parallel race | Run two cheap checkable backends in parallel |

### 6.7 Learned Constraint Exchange [CONFIRMED 2026-01-07]

| Decision | Backends may exchange learned constraints through the orchestrator |
|----------|-------------------------------------------------------------------|
| Rule | Learned constraints must be canonical and use only existing symbols |
| Safety | Exchange is optional; correctness cannot depend on it |

### 6.8 Performance Gates (Initial Targets) [CONFIRMED 2026-01-07]

| Target | Threshold |
|--------|-----------|
| CNL parse + typecheck | 10k lines < 1s |
| UBH compile | 100k predicate instances < 2s |
| Kernel memory | 1e6 wire ids without crash |
| Simple query latency | < 200ms (1k facts, 100 rules) |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-01-06 | Initial document created |
| 2026-01-06 | Added case-sensitivity decision (keep original case) |
| 2026-01-06 | **MAJOR UPDATE**: Confirmed all syntax decisions |
| 2026-01-06 | DSL: `@` only at declaration, `$` for references |
| 2026-01-06 | DSL: Forbidden `()` and `[]`, use `{ }` for grouping |
| 2026-01-06 | DSL: Block syntax `ForAll T graph v ... end` |
| 2026-01-06 | DSL: KB storage with `@name:kbName` |
| 2026-01-06 | CNL: SVO order, block syntax for Rule/Definition/Theorem |
| 2026-01-06 | CNL: Forbidden pronouns, ellipsis |
| 2026-01-06 | DSL: `$` only for bound variables or named expressions; constants are bare |
| 2026-01-06 | DSL: Added probabilistic `Weight` statements and `ProbQuery` blocks |
| 2026-01-06 | DSL: Working-memory names use `$`; KB names are bare and preferred in explanations |
| 2026-01-06 | Sys2 is the lexicon source of truth; no external lexicon files |
| 2026-01-06 | Sys2 carries schemas/metadata/explanation-ready annotations |
| 2026-01-07 | **NO EXTERNAL LEXICON FILES**: Domain knowledge in CNL/DSL theories |
| 2026-01-07 | **HUMAN NAMES**: `@var:humanName` syntax for display names |
| 2026-01-07 | Created `/theories/` folder with domain theories |
| 2026-01-07 | CNL natural patterns: `X has Y`, `X trusts Y`, no parentheses |
| 2026-01-07 | Translator support for `Or`, `Iff`, and complex negation patterns |
| 2026-01-07 | Added new test suites: 15_disjunction, 16_biconditional, 17_negation |
| 2026-01-07 | Created theories/core/probability.cnl and theories/core/modal.cnl |
| 2026-01-07 | Expanded domain theories: medical.cnl (130+ lines), family.cnl, social.cnl |
| 2026-01-07 | Added `load` directive to CNL (DS05) and DSL (DS08) for theory loading |
| 2026-01-07 | Documented CNL vs DSL architecture rationale (Section 1.5) |
| 2026-01-07 | `load` paths must be RELATIVE to current file (no absolute paths) |
| 2026-01-07 | `load` supports both `.cnl` and `.sys2` files |
| 2026-01-07 | Finite domain lowering: explicit enumeration for CNL/DSL |
| 2026-01-07 | Vocabulary merge policy: no automatic namespacing or shadowing |
| 2026-01-07 | Orchestrator heuristics defaults recorded |
| 2026-01-07 | Learned constraint exchange policy recorded |
| 2026-01-07 | Performance gates added to spec targets |

---

## Appendix A: Specification Map

### A.1 Where to Find What

| Topic | Primary Spec | Related Files |
|-------|--------------|---------------|
| **Vision & Architecture** | `DS00-vision.md` | System diagram, layers |
| **UBH Kernel** | `DS01-ir-hashcons.md` | Wire/gate storage, hash-consing |
| **SAT+XOR Solver** | `DS02-solver-xor.md` | Solving strategy |
| **CNL Syntax** | `DS05-cnl-lexicon.md` | Natural language patterns |
| **DSL Syntax** | `DS08-dsl.md` | Machine-readable format |
| **CNL↔DSL Translation** | `DS18-cnl-translator.md` | Bidirectional mapping |
| **Proof Format** | `DS20-proof-format.md` | Proof trace structure |
| **Holographic Reasoning** | `DS21-holographic-reasoning.md` | VSA/HDC/HRR parallel engine |

### A.2 DS Numbering Scheme

| Range | Category | Examples |
|-------|----------|----------|
| DS00-DS09 | Core infrastructure | Vision, IR, Solver, Schema |
| DS10-DS14 | Orchestrator & backends | Fragments, Backends, Certs |
| DS15-DS19 | Languages & translation | CNL, DSL, Keywords |
| DS20+ | Extensions | Proofs, future features |

### A.3 Key Folders

| Folder | Purpose |
|--------|---------|
| `/docs/specs/DS/` | Design specifications (normative) |
| `/docs/specs/DECISIONS.md` | This file - all confirmed decisions |
| `/theories/` | Reusable CNL/DSL domain theories |
| `/theories/domains/` | medical, family, social, biology, arithmetic |
| `/evals/fastEval/` | Test suites with source.cnl + expected.sys2 |
| `/src/cnlTranslator/` | CNL → DSL translator implementation |
