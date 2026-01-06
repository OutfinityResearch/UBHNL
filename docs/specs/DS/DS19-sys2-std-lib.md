# DS19: Reserved Keywords and Operators

## Goal

Define the complete set of reserved keywords and operators for both CNL and DSL, ensuring:
- No conflicts between keywords and vocabulary symbols
- Deterministic parsing in both languages
- Clear mapping between CNL and DSL keywords

## CNL Reserved Keywords

CNL uses natural language-like keywords. All are **case-insensitive**.

### Quantifiers
| Keyword | Role | DSL Equivalent |
|---------|------|----------------|
| `for` | Part of "for all" | - |
| `all` | Part of "for all" | - |
| `every` | Alias for "all" | - |
| `each` | Alias for "all" | - |
| `for all` | Universal quantifier | `forall` |
| `for every` | Universal quantifier | `forall` |
| `for each` | Universal quantifier | `forall` |
| `exists` | Existential quantifier | `exists` |
| `there` | Part of "there exists" | - |
| `there exists` | Existential quantifier | `exists` |
| `some` | Existential quantifier | `exists` |
| `find` | Query hole marker | `exists ?` |
| `which` | Query hole marker | `exists ?` |

### Logical Connectives
| Keyword | Role | DSL Equivalent |
|---------|------|----------------|
| `and` | Conjunction | `and` |
| `or` | Disjunction | `or` |
| `not` | Negation | `not` |
| `implies` | Implication | `implies` |
| `if` | Part of "if...then" | - |
| `then` | Part of "if...then" | - |
| `whenever` | Implication sugar | `implies` |
| `means` | Implication sugar | `implies` |

### Other Reserved Words
| Keyword | Role |
|---------|------|
| `in` | Domain binding |
| `is` | Declaration ("X is a Y") |
| `a` | Article (ignored) |
| `an` | Article (ignored) |
| `has` | Subject-predicate sugar |
| `have` | Subject-predicate sugar |
| `such` | Part of "such that" |
| `that` | Part of "such that" |
| `true` | Boolean literal |
| `false` | Boolean literal |

## DSL Reserved Keywords

DSL uses programming-language-like keywords. All are **case-sensitive** (lowercase).

### Core Keywords
| Keyword | Role |
|---------|------|
| `forall` | Universal quantifier |
| `exists` | Existential quantifier |
| `in` | Domain binding |
| `and` | Conjunction |
| `or` | Disjunction |
| `not` | Negation |
| `implies` | Implication |
| `true` | Boolean literal |
| `false` | Boolean literal |

### Operator Symbols (DSL only)
| Symbol | Equivalent Keyword |
|--------|-------------------|
| `->` | `implies` |
| `!` | `not` |
| `&` | `and` |
| `\|` | `or` |

### Special Prefixes (DSL only)
| Prefix | Meaning |
|--------|---------|
| `@` | Statement target / declaration |
| `$` | Bound variable reference |
| `?` | Hole (returnable witness) |
| `#` | Comment to end of line |

## Keyword Mapping Table

| CNL (case-insensitive) | DSL (case-sensitive) |
|------------------------|----------------------|
| `for all` | `forall` |
| `for every` | `forall` |
| `for each` | `forall` |
| `there exists` | `exists` |
| `exists` | `exists` |
| `some` | `exists` |
| `find ... such that` | `exists ?...` |
| `which ... has` | `exists ?...` |
| `if A then B` | `A implies B` |
| `whenever A, B` | `A implies B` |
| `A means B` | `A implies B` |
| `A implies B` | `A implies B` |
| `A and B` | `A and B` |
| `A or B` | `A or B` |
| `not A` | `not A` |
| `X is a Type.` | `@x:Type` |
| `X has pred.` | `@x pred` |
| `true` | `true` |
| `false` | `false` |

## Naming Conventions

### Type/Domain Names
- **Style**: `PascalCase`
- **Examples**: `Cell`, `Person`, `GeneProduct`

### Predicate Names
- **Style**: `snake_case` or `lowerCamelCase` (project-wide choice)
- **Examples**: `has_fever`, `proteinP`, `geneA`

### Constant Names
- **Style**: `lowerCamelCase` or indexed (`c0`, `p1`)
- **Examples**: `ion`, `maria`, `c0`, `cell1`

### Variable Names (in quantifiers)
- **Style**: Single lowercase letter or short lowercase word
- **Examples**: `c`, `x`, `person`, `cell`

## Escaping Reserved Words

If a vocabulary symbol conflicts with a reserved word:

**DSL**: Use backticks
```sys2
@`true`:Bool    # declares a constant named "true"
```

**CNL**: Use quotes
```cnl
"true" is a Bool.
```

**Recommendation**: Avoid conflicts by choosing different names.

## Validation Rules

### Lexicon Validation
The lexicon loader must reject:
- Domain names that are reserved words
- Predicate names that are reserved words
- Constant names that are reserved words
- Alias keys that conflict with predicates

### Parse-time Validation
- CNL: Keywords take precedence over vocabulary lookup
- DSL: `@`/`$`/`?` prefixes are lexed before keyword matching

## Examples

### Valid Vocabulary
```json
{
  "domains": {
    "Cell": ["c0", "c1"],
    "Person": ["ion", "maria"]
  },
  "predicates": {
    "geneA": { "arity": 1, "args": ["Cell"] },
    "has_fever": { "arity": 1, "args": ["Person"] }
  }
}
```

### Invalid Vocabulary (rejected)
```json
{
  "domains": {
    "true": ["t1", "t2"]     // ERROR: "true" is reserved
  },
  "predicates": {
    "and": { "arity": 2, ... }  // ERROR: "and" is reserved
  }
}
```

## References

- DS-005 (CNL grammar and lexicon)
- DS-008 (DSL grammar)
- DS-016 (error codes for keyword conflicts)
- DS-018 (CNL ↔ DSL translation)
