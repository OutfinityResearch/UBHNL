# Spec: src/dsl/tokenizer.mjs

## Goal
Transform raw text into a stream of tokens for the Sys2 DSL (DS-08). Handles regex matching, skipping whitespace/comments, and tracking source location (lines/columns).

## Dependencies
- `src/utils/errors.mjs`: For `E_DSL_SYNTAX`.

## Public Exports

### Types
- `TokenType`: Enum/Strings (`KEYWORD`, `IDENT`, `SYMBOL`, `NUMBER`, `STRING`, `EOF`).
- `Token`: `{ type, value, line, column, start, end }`.

### Class `Tokenizer`
- **Constructor**: `(source, sourceId)`
- **Methods**:
  - `next(): Token` - Returns next token and advances.
  - `peek(): Token` - Returns next token without advancing.
  - `isEOF(): boolean`

## Logic & Constraints
- **Keywords**: `ForAll`, `Exists`, `Vocab`, `Domain`, `Const`, `Pred`, `Func`, `Assert`, `Check`, `And`, `Or`, `Not`, `Implies`, `Iff`, `Xor`, `true`, `false`, `weight`, `end`, `return`.
- **Symbols**: `@`, `$`, `:`, `{`, `}`.
- **Skipping**: Spaces, newlines, comments (`#` and `//`).
- **Error**: Throw `UbhnlError` if an invalid character sequence is encountered.
