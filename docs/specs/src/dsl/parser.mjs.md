# Spec: src/dsl/parser.mjs

## Goal
Implement the Recursive Descent Parser for Sys2 DSL. It consumes tokens and produces an AST.

## Dependencies
- `src/dsl/tokenizer.mjs`: For token stream.
- `src/dsl/ast.mjs`: For node creation.
- `src/utils/errors.mjs`: For parsing errors.

## Public Exports

### Function `parseDSL(source, sourceId)`
- **Input**: `source` (string), `sourceId` (string).
- **Output**: `Program` (array of Statements).

## Logic & Constraints
- **Main Loop**: `parseStatement()` until EOF.
- **Statement Parsing**:
  - `Vocab` -> `parseVocabBlock()`
  - `Assert`/`Check` -> `parseAssertion()`
  - `@...` -> `parseDeclaration()` or `parseDefinition()` or `parseQuantified()` depending on lookahead.
- **Expression Parsing**:
  - Support nested `{ ... }`.
  - Handle operator precedence for non-grouped expressions.
- **Error Handling**:
  - Use `tokenizer.peek()` to check expectations.
  - Throw `UbhnlError` with `E_DSL_SYNTAX` on mismatch.
  - Include hints in error details (e.g., "Expected 'end' but found 'EOF'").
