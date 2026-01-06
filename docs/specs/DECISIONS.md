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
| Lexicon | `.lexicon.json` | JSON with clear purpose |

### 1.3 Translation Direction [CONFIRMED]

| Decision | Supported |
|----------|-----------|
| CNL → DSL | Yes (for storage) |
| DSL → CNL | Yes (for display/explanation) |
| Round-trip guarantee | Yes (lossless) |

---

## 2. DSL Syntax Decisions [CONFIRMED]

### 2.1 Variable Declaration

| Decision | `@` declares a variable/expression name |
|----------|----------------------------------------|
| Syntax | `@name __Atom` or `@name expression` |
| Example | `@Alice __Atom`, `@rule1 Implies $a $b` |
| Invariant | Each `@name` appears exactly once |

### 2.2 Variable Reference

| Decision | `$` references a declared variable |
|----------|-----------------------------------|
| Syntax | `$name` |
| Example | `Implies $a $b`, `HasFever $p` |
| Scope | Variables must be in scope |

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
