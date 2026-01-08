# Spec: src/dsl/ast.mjs

## Goal
Define the data structures (classes) for the Typed AST (DS-06). These act as the contract between the Parser and the Session/Compiler.

## Dependencies
- None.

## Public Exports

### Base Class
- `class Expr { constructor(origin) }`

### Logical Expressions
- `class ForAll extends Expr { constructor(varName, domain, body, origin) }`
- `class Exists extends Expr { constructor(varName, domain, body, origin) }`
- `class And extends Expr { constructor(args[], origin) }`
- `class Or extends Expr { constructor(args[], origin) }`
- `class Not extends Expr { constructor(arg, origin) }`
- `class Implies extends Expr { constructor(lhs, rhs, origin) }`
- `class Predicate extends Expr { constructor(name, args[], origin) }`
  - `args` are `Term` objects.

### Terms
- `class Term { constructor(origin) }`
- `class VarRef extends Term { constructor(name, origin) }`
- `class ConstRef extends Term { constructor(name, domain, origin) }`
- `class NumLit extends Term { constructor(value, origin) }`

### Statements
- `class VocabularyBlock { constructor(declarations[], origin) }`
- `class Assert { constructor(expr, origin) }`
- `class Check { constructor(expr, origin) }`
- `class Definition { constructor(name, params, body, origin) }`

## Logic
- Pure data classes.
- Should include `type` property (string) for easy traversing without `instanceof` checks if preferred.
