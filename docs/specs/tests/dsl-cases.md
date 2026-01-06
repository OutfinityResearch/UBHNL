# DSL Test Cases (Parsing + Typing)

These cases are normative for the DSL in `docs/specs/DS/008-dsl.md`.

## Shared Lexicon (for examples)
Use the lexicon from `docs/specs/tests/cnl-cases.md`.

## Accepted Inputs
### 1) Exported entity declaration
Input:
```
@c2:Cell
```
Expected:
- `c2` becomes a vocabulary constant of type `Cell` (load-time symbol table update).

### 2) Fact statement (unary predicate)
Input:
```
@c0 proteinP
```
Expected:
- parses as a fact statement,
- desugars to predicate application `proteinP(c0)`,
- `proteinP` must exist in the vocabulary and have arity 1 with args `[Cell]`.

### 3) Export + use bare vocabulary constant
Input:
```
@ion:Person
@flu:Disease
@ion has_flu flu
```
Expected:
- `has_flu(ion, flu)` with correct typing.

### 4) Quantified rule (core logic)
Input:
```
forall $c in Cell: geneA($c) implies proteinP($c)
```
Expected core AST shape:
`ForAll(c:Cell, Implies(Pred(geneA,[c]), Pred(proteinP,[c])))`

### 5) Hole binder (query witness)
Input:
```
exists ?c in Cell: proteinP(?c)
```
Expected:
- parses as an existential quantifier with a “returnable witness” binder,
- `?c` is tracked as a hole for the session/orchestrator (DS-009).

## Rejected Inputs (must error)
### 1) Unknown type
Input:
```
@x:UnknownType
```
Expected: `ResolveError`.

### 2) Two `@` tokens on one line
Input:
```
@p0 likes @p1
```
Expected: `ParseError` (violates “at most one `@...` per line”).
Hint in error: “use `$p1` to reference a variable, or declare `p1` as a vocabulary constant and use it bare”.

### 3) `$` reference out of scope
Input:
```
@p0 likes $p1
```
Expected: `ResolveError` (unbound `$p1`).

### 4) Unknown bare vocabulary symbol
Input:
```
@p0 likes p999
```
Expected: `ResolveError` (unknown vocabulary constant `p999`).

### 5) Arity mismatch via fact statement
Assume `proteinP(Cell)` has arity 1.
Input:
```
@c0 proteinP c1
```
Expected: `TypeError` (attempts `proteinP(c0, c1)` but `proteinP` is arity 1).

