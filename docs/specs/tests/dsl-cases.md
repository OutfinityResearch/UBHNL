# DSL Test Cases (Parsing + Typing)

These cases are normative for the DSL in `docs/specs/DS/DS08-dsl.md`.

## Shared Vocabulary (for examples)
Use the shared vocabulary from `docs/specs/tests/cnl-cases.md`.

## Accepted Inputs
### 1) Constant declaration + typing
Input:
```
Vocab
    Domain Cell
    Const c2 Cell
end
```
Expected:
- `c2` is declared and typed as a `Cell`.

### 2) Fact statement (unary predicate, named)
Input:
```
Vocab
    Domain Cell
    Const c0 Cell
end

@f1 proteinP c0
```
Expected:
- parses as a named fact statement,
- desugars to predicate application `proteinP(c0)` with a named binding `f1`,
- `proteinP` must exist in the vocabulary and have arity 1 with args `[Cell]`.

### 3) Multi-argument predicate (typed)
Input:
```
Vocab
    Domain Person
    Const p0 Person
    Const p1 Person
end

@f1 trusts p0 p1
```
Expected:
- `trusts(p0, p1)` with correct typing.

### 4) Quantified rule (core logic, block form)
Input:
```
Vocab
    Domain Cell
end

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
Vocab
    Domain Person
end

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
@x:x __Atom
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
Vocab
    Domain Cell
    Const c0 Cell
    Const c1 Cell
end

proteinP c0 c1
```
Expected: `TypeError` (attempts `proteinP(c0, c1)` but `proteinP` is arity 1).
