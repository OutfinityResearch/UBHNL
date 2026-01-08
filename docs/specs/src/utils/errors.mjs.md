# Spec: src/utils/errors.mjs

## Goal
Implement the error handling system defined in **DS-016**. This module provides the standard error classes and reporting mechanisms used throughout the entire system.

## Dependencies
- None (Base module).

## Public Exports

### Constants (Error Codes)
Export string constants for all error codes defined in DS-016.
- `E_DSL_SYNTAX`, `E_DSL_TWO_AT`, `E_DSL_AT_IN_EXPR`
- `E_UNKNOWN_SYMBOL`, `E_TYPE_MISMATCH`
- `E_CERT_MISSING`, `E_INTERNAL_ERROR`
- ... (full list from DS-16)

### Types (JSDoc)
- `Origin`: `{ sourceId, line, column, snippet, format }`
- `ErrorReport`: `{ ok: false, error: { kind, code, message, blame, origin?, details? } }`

### Classes

#### `class UbhnlError extends Error`
Base class for all system errors.
- **Constructor**: `(code, message, blame, origin?, details?)`
- **Properties**:
  - `code`: string (one of the constants)
  - `kind`: string (derived from code prefix, e.g., 'E_DSL_' -> 'ParseError')
  - `blame`: 'UserInput' | 'TheoryFile' | 'System'
  - `origin`: Origin object (optional)
  - `details`: Object (optional context)
- **Methods**:
  - `toReport()`: Returns the `ErrorReport` structure.
  - `toString()`: Returns a formatted string suitable for CLI output (with snippet and pointer).

## Logic & Constraints
- Keep simple and dependency-free.
- Ensure `toString()` format is human-readable as this is the primary CLI feedback mechanism.
