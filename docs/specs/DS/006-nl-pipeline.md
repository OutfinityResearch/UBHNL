# DS-006: NL Parsing and Typed AST Pipeline

## Goal
Specify the pipeline that converts CNL input into a typed AST suitable for UBH compilation.

## Pipeline Stages
1) Tokenize input (keywords, identifiers, punctuation)
2) Parse to a concrete syntax tree
3) Build typed AST nodes
4) Type-check and resolve symbols against the lexicon
5) Desugar to a small core logic (forall, exists, and, or, not, implies)

## AST Nodes (Core)
- ForAll(var, domain, body)
- Exists(var, domain, body)
- And(lhs, rhs)
- Or(lhs, rhs)
- Not(expr)
- Implies(lhs, rhs)
- Pred(name, args)
- Eq(lhs, rhs) [optional]

## Error Handling
- Unknown symbols or type mismatches are hard errors.
- Ambiguous parses are rejected with a clear message.

## Rationale
The typed AST isolates language concerns from the UBH kernel and provides a stable contract for compilation.
