# CNL Test Cases (Determinism + Typing)

These cases are normative for the CNL grammar in `docs/specs/DS/005-cnl-lexicon.md`.
They are written as “input → expected shape” (not exact formatting).

## Shared Lexicon (for examples)
```json
{
  "version": 1,
  "domains": {
    "Cell": ["c0", "c1"],
    "Person": ["p0"]
  },
  "constants": {
    "c0": "Cell",
    "c1": "Cell",
    "p0": "Person"
  },
  "predicates": {
    "geneA": { "arity": 1, "args": ["Cell"] },
    "inhibitor": { "arity": 1, "args": ["Cell"] },
    "proteinP": { "arity": 1, "args": ["Cell"] },
    "has_flu": { "arity": 1, "args": ["Person"] },
    "has_fever": { "arity": 1, "args": ["Person"] }
  },
  "aliases": {
    "protein p": "proteinP"
  }
}
```

## Accepted Inputs
### 1) Basic quantifier + implication
Input:
`for all x in Cell: geneA(x) implies proteinP(x)`

Expected core AST shape:
`ForAll(x:Cell, Implies(Pred(geneA,[x]), Pred(proteinP,[x])))`

### 2) “Domain var” binder form
Input:
`for all cell c: geneA(c) implies proteinP(c)`

Expected: same as case (1).

### 3) If/then sugar
Input:
`for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)`

Expected core AST shape:
`ForAll(c:Cell, Implies(And(Pred(geneA,[c]), Not(Pred(inhibitor,[c]))), Pred(proteinP,[c])))`

### 4) Exists + conjunction
Input:
`exists person p: has_fever(p) and has_flu(p)`

Expected:
`Exists(p:Person, And(Pred(has_fever,[p]), Pred(has_flu,[p])))`

### 5) Aliases
Input:
`for all cell c: geneA(c) implies protein p(c)`

Expected: alias `protein p` resolves to `proteinP`.

## Rejected Inputs (with expected category)
### 1) Missing domain
Input: `for all x: proteinP(x)`
Expected: `ResolveError` or `TypeError` (missing domain/binder type).

### 2) Unknown predicate
Input: `for all cell c: unknownPred(c)`
Expected: `ResolveError`.

### 3) Arity mismatch
Input: `proteinP(c0, c1)`
Expected: `TypeError` (arity mismatch).

### 4) Type mismatch
Input: `proteinP(p0)`
Expected: `TypeError` (expected `Cell`, got `Person`).

### 5) Undeclared variable
Input: `for all cell c: proteinP(x)`
Expected: `ResolveError` (undeclared variable `x`).

### 6) Missing connector
Input: `for all cell c: geneA(c) inhibitor(c)`
Expected: `ParseError` (missing `and/or/implies`).

