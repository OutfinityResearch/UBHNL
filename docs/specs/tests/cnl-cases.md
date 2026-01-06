# CNL Test Cases (DS-005)

These cases are normative for the CNL grammar and lexicon contract in `docs/specs/DS/DS05-cnl-lexicon.md`.
They focus on determinism (one parse) and typing (lexicon-driven).

## Shared Lexicon (for examples)
```json
{
  "version": "1.0",
  "domains": {
    "Cell": ["c0", "c1"],
    "Person": ["p0", "p1"]
  },
  "predicates": {
    "geneA": { "arity": 1, "args": ["Cell"] },
    "inhibitor": { "arity": 1, "args": ["Cell"] },
    "proteinP": { "arity": 1, "args": ["Cell"] },
    "has_flu": { "arity": 1, "args": ["Person"] },
    "has_fever": { "arity": 1, "args": ["Person"] },
    "trusts": { "arity": 2, "args": ["Person", "Person"] }
  },
  "cnlPatterns": {
    "has gene A": "geneA($1)",
    "has inhibitor": "inhibitor($1)",
    "has protein P": "proteinP($1)",
    "protein p": "proteinP($1)",
    "has flu": "has_flu($1)",
    "has fever": "has_fever($1)",
    "trusts": "trusts($1, $2)"
  }
}
```

## Accepted Inputs

### 1) Natural fact (SVO + lexicon pattern)
Input:
```cnl
c0 has gene A.
```
Expected core AST shape:
`Pred(geneA,[ConstRef(c0:Cell)])`

### 2) Semi-formal quantified rule (block + If/then)
Input:
```cnl
For any Cell c:
    If c has gene A then c has protein P.
```
Expected core AST shape:
`ForAll(c:Cell, Implies(Pred(geneA,[c]), Pred(proteinP,[c])))`

### 3) Conjunction + negation in a rule
Input:
```cnl
For any Cell c:
    If c has gene A and c does not have inhibitor then c has protein P.
```
Expected core AST shape:
`ForAll(c:Cell, Implies(And(Pred(geneA,[c]), Not(Pred(inhibitor,[c]))), Pred(proteinP,[c])))`

### 4) Query (witness search)
Input:
```cnl
Which Person p has fever?
```
Expected core AST shape:
`Exists(p:Person, Pred(has_fever,[p]))`

### 5) Alias / surface phrase expansion
Input:
```cnl
For any Cell c:
    If c has gene A then protein p(c).
```
Expected:
- `protein p(c)` expands via `cnlPatterns` to `proteinP(c)`.

### 6) Transitive verb (SVO with 2-arg predicate)
Input:
```cnl
p0 trusts p1.
```
Expected core AST shape:
`Pred(trusts,[ConstRef(p0:Person), ConstRef(p1:Person)])`

## Rejected Inputs (with expected category)

### 1) Missing statement terminator
Input:
```cnl
c0 has gene A
```
Expected: `ParseError` (`E_CNL_MISSING_PERIOD`).

### 2) Unknown surface phrase (strict lexicon patterns)
Input:
```cnl
p0 has headache.
```
Expected: `LexiconError` / `VocabError` (`E_CNL_UNKNOWN_ALIAS`).

### 3) Type mismatch (predicate expects Person, got Cell)
Input:
```cnl
c0 has fever.
```
Expected: `TypeError` (`E_TYPE_MISMATCH`).

### 4) Unknown constant (not in any declared domain)
Input:
```cnl
c99 has gene A.
```
Expected: `VocabError` (unknown identifier).

### 5) Missing connector in an expression
Input:
```cnl
For any Cell c:
    If geneA(c) inhibitor(c) then proteinP(c).
```
Expected: `ParseError` (`E_CNL_MISSING_CONNECTOR`).
