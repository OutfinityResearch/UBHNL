# DS-005: Controlled Natural Language and Lexicon

## Goal
Define a controlled natural language (CNL) that maps deterministically to a typed logical AST for UBH compilation.

## Decisions
- The language is constrained and explicit: quantifiers, connectors, and scopes are mandatory.
- A lexicon file defines entities, predicates, relations, and types.
- Ambiguity is rejected rather than guessed.

## Core Constructs
- Quantifiers: "for all", "exists"
- Connectors: "and", "or", "not", "implies"
- Predicates: P(x) or P(x, y)
- Types: Person, Disease, Cell, etc. (finite domains)

## Example CNL
- "for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)"
- "exists person p: has_fever(p) and has_flu(p)"

## Lexicon Format (JSON)
- entities: named constants with a type
- predicates: name + arity + argument types
- domains: finite lists of symbols

Example:
```
{
  "domains": {"Cell": ["c0", "c1"]},
  "entities": {"geneA": "Predicate"},
  "predicates": {
    "proteinP": {"arity": 1, "types": ["Cell"]}
  }
}
```

## Invariants
- All symbols must be declared in the lexicon.
- All quantifiers must include domain and variable names.
- All operators must be explicit (no implicit precedence).

## Rationale
CNL reduces ambiguity and enables deterministic compilation while preserving an NL-like surface.
