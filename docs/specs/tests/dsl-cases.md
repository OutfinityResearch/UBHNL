# DSL Test Cases (Parsing + Typing)

These cases are normative for the DSL in `docs/specs/DS/DS08-dsl.md`.

## Shared Lexicon (for examples)
Use the lexicon from `docs/specs/tests/cnl-cases.md`.

## Accepted Inputs
### 1) Constant declaration + typing
Input:
```
@Cell __Atom
@c2 __Atom
IsA c2 Cell
```
Expected:
- `c2` is declared and typed as a `Cell`.

### 2) Fact statement (unary predicate, named)
Input:
```
@Cell __Atom
@c0 __Atom
IsA c0 Cell

@f1 proteinP c0
```
Expected:
- parses as a named fact statement,
- desugars to predicate application `proteinP(c0)` with a named binding `f1`,
- `proteinP` must exist in the vocabulary and have arity 1 with args `[Cell]`.

### 3) Multi-argument predicate (typed)
Input:
```
@Person __Atom
@p0 __Atom
@p1 __Atom
IsA p0 Person
IsA p1 Person

@f1 trusts p0 p1
```
Expected:
- `trusts(p0, p1)` with correct typing.

### 4) Quantified rule (core logic, block form)
Input:
```
@Cell __Atom

@rule1 ForAll Cell graph c
    @g geneA $c
    @p proteinP $c
    @imp Implies $g $p
    return $imp
end
```
Expected core AST shape:
`ForAll(c:Cell, Implies(Pred(geneA,[c]), Pred(proteinP,[c])))`

### 5) Existential query (witness is the binder variable)
Input:
```
@Person __Atom

@query1 Exists Person graph p
    @c1 has_fever $p
    return $c1
end
```
Expected:
- parses as an existential block,
- the witness is the bound variable `p` introduced by `Exists ... graph p`,
- the session/orchestrator may return a concrete assignment for `p` on `SAT`.

## Rejected Inputs (must error)
### 1) Unknown type
Input:
```
@x __Atom
IsA x UnknownType
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
geneA $c
```
Expected: `ResolveError` (unbound `$c`).

### 4) Unknown bare vocabulary symbol
Input:
```
geneA c99
```
Expected: `ResolveError` (unknown constant `c99`).

### 5) Arity mismatch via fact statement
Assume `proteinP(Cell)` has arity 1.
Input:
```
@Cell __Atom
@c0 __Atom
@c1 __Atom
IsA c0 Cell
IsA c1 Cell

proteinP c0 c1
```
Expected: `TypeError` (attempts `proteinP(c0, c1)` but `proteinP` is arity 1).
