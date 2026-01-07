# CNL Test Cases (DS-005)

These cases are normative for the CNL grammar and vocabulary contract in `docs/specs/DS/DS05-cnl-lexicon.md`.
They focus on determinism (one parse) and typing (schema-driven).

## Shared Vocabulary (sys2 schema excerpt)
```sys2
# File: tests/shared-vocab.sys2
@Cell:Cell __Atom
@Person:Person __Atom

@c0:c0 __Atom
IsA c0 Cell
@c1:c1 __Atom
IsA c1 Cell
@p0:p0 __Atom
IsA p0 Person
@p1:p1 __Atom
IsA p1 Person

@geneA:geneA __Atom
@inhibitor:inhibitor __Atom
@proteinP:proteinP __Atom
@has_flu:has_flu __Atom
@has_fever:has_fever __Atom
@trusts:trusts __Atom
```

## Accepted Inputs

### 1) Natural fact (SVO + fixed CNL pattern)
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

### 5) Explicit predicate syntax (fallback form)
Input:
```cnl
For any Cell c:
    If c has gene A then proteinP(c).
```
Expected:
- `proteinP(c)` is parsed as function-style syntax (DS-005).

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

### 2) Unknown surface phrase (fixed CNL patterns)
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
