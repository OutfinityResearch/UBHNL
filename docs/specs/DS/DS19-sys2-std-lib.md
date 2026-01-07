# DS19: Reserved Keywords and Tokens (CNL + Sys2 DSL)

## Goal

Define the reserved keywords/tokens for:
- **CNL** (DS-005), and
- **Sys2 DSL** (DS-008),
so parsing remains deterministic and vocabulary symbols cannot collide with language keywords.

## CNL Reserved Keywords (DS-005)

CNL keywords are **case-insensitive**.

### Quantifiers / binders
- `For any`, `For all`, `For every`, `For each`
- `Every`, `Each`
- `There exists`, `Some`
- `Which` (witness query)
- `Find` (witness query)

### Logical words
- `and`, `or`
- `not`, `does not`, `is not`
- `If`, `then`
- `implies`, `iff`

### Declaration / sugar
- `Let`, `be`, `a`, `an`, `Domain`
- `is` (type declaration / adjective forms)
- `has` (subject–predicate sugar)
- `Alias`, `subtype` (aliasing and subtyping)

### Proof keywords (DS-020)
- `Proof`, `Given`, `Assume`, `Apply`, `Derive`, `Observed`, `Hypothesis`
- `Verify`, `Constraint`, `Contradiction`, `Query`, `Found`, `Therefore`

### Boolean literals
- `true`, `false`

## Sys2 DSL Reserved Keywords (DS-008)

Sys2 DSL keywords are **case-sensitive**.

### Core keywords and operators
- Quantifiers / blocks: `ForAll`, `Exists`, `graph`, `return`, `end`
- Logical connectives: `And`, `Or`, `Not`, `Implies`, `Iff`, `Xor`
- Typing / declarations: `IsA`, `__Atom`
- Literals: `true`, `false`
- Probabilistic: `Weight`, `ProbQuery`, `Ask`, `Given`
- Vocabulary: `Vocab`, `Domain`, `Const`, `Pred`, `Func`
- Schema relations: `SubType`, `Alias`
- Proof: `Proof`, `Given`, `Assume`, `Apply`, `Derive`, `Observed`, `Hypothesis`, `Verify`, `Constraint`, `Contradiction`, `Query`, `Found`, `Therefore`, `Note`

### Special tokens (not identifiers)
- `@` declaration target (start of statement only; at most one per line)
- `$` reference to a working-memory name (bound variable or local named expression)
- `:` KB storage name (after `@name`) or KB naming (`@:kbName`)
- `{` `}` anonymous grouping
- `#` comment to end of line

Sys2 DSL does **not** define a `?` token.

## Keyword Mapping (CNL → Sys2 DSL)

| CNL (surface) | Sys2 DSL (canonical target) |
|---|---|
| `For any Type x:` (block) | `@ruleN ForAll Type graph x ... return $expr end` |
| `There exists Type x:` (block) | `@exN Exists Type graph x ... return $expr end` |
| `Which Type x ... ?` | `@queryN Exists Type graph x ... return $expr end` |
| `If A then B.` | `@impN Implies { A } { B }` (after lowering) |
| `A and B` | `And ...` |
| `A or B` | `Or ...` |
| `not A` | `Not ...` |

Note: concrete predicate surface forms in CNL are governed by the fixed patterns in DS-005.

## Reserved-word conflicts (policy)

Reserved keywords must not be used as:
- domain/type names,
- predicate names,
- constants (domain elements).

No escaping mechanism is defined in Sys2 DSL; choose different vocabulary symbols.

## References

- DS-005 (CNL grammar and lexicon)
- DS-008 (Sys2 DSL grammar)
- DS-016 (error codes)
- DS-018 (CNL ↔ Sys2 translator)
