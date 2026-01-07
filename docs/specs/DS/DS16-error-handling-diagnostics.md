# DS16: Error Handling and Diagnostics

## Goal

Make UBHNL errors and diagnostics:
- **Consistent** across CNL/DSL/front-ends/backends/checkers
- **Deterministic** for reproducibility and testing
- **Actionable** with clear blame and next steps
- **Auditable** with origins and traces

## Principles (Normative)

1. **Deterministic**: Same inputs produce same error kind/code and stable location data
2. **Strict vocabulary**: Unknown symbols are load errors, never silently introduced
3. **Explicit blame**: Errors indicate who must change something
4. **UNKNOWN is not an error**: Budgets or missing certificates are reported as `UNKNOWN` with diagnostics

## Error Taxonomy

### ErrorKind (Coarse Category)

| ErrorKind | Description |
|-----------|-------------|
| `ParseError` | Syntax/grammar violation |
| `LexiconError` | Invalid/missing type/predicate signature in lexicon |
| `VocabError` | Unknown bare symbol; forbidden identifier |
| `TypeError` | Type mismatch, arity mismatch, sort mismatch |
| `TranslationError` | CNL ↔ DSL translation failure |
| `SchemaError` | Invalid schema, instantiation failure |
| `LoweringError` | Cannot lower fragment/operator to UBH |
| `BackendError` | Backend failed to execute |
| `CertificateError` | Missing/invalid/unsupported certificate |
| `CheckError` | Theorem/check obligation failed or was unknown |
| `InternalError` | Bug; invariant violation |

### Blame (Who Must Fix It)

| Blame | Description |
|-------|-------------|
| `UserInput` | Typo, invalid syntax in interactive input |
| `TheoryFile` | A loaded file is inconsistent/invalid |
| `Backend` | Backend crash or unsupported feature |
| `System` | UBHNL bug or broken invariant |

## Standard Error Payload

All public APIs that can fail must return an `ErrorReport`:

```typescript
interface ErrorReport {
  ok: false;
  error: {
    kind: ErrorKind;
    code: string;           // e.g., "E_DSL_TWO_AT"
    message: string;        // Human-readable summary (one sentence)
    blame: Blame;
    origin?: Origin;
    details?: ErrorDetails;
  };
}

interface Origin {
  sourceId: string;
  path?: string;
  line: number;
  column: number;
  snippet?: string;
  format: "CNL" | "DSL" | "API";
}

interface ErrorDetails {
  expected?: string;
  got?: string;
  hint?: string;
  backendId?: string;
  checkerId?: string;
  problemDigest?: string;
}
```

### Rules
- `message` must be stable (no timestamps, random ids)
- `origin` must be included for user-provided text errors
- `details` may be used by tooling/IDE integrations

## Error Codes (Complete List)

### CNL Parsing Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_CNL_SYNTAX` | General CNL syntax error | `For all c` (missing colon) |
| `E_CNL_MISSING_PERIOD` | Statement not terminated | `Ion has fever` (no `.`) |
| `E_CNL_MISSING_DOMAIN` | Quantifier without domain | `For all c: P($c).` |
| `E_CNL_MISSING_CONNECTOR` | Adjacent atoms without connector | `geneA($c) proteinP($c)` |
| `E_CNL_UNKNOWN_ALIAS` | Predicate phrase not mapped by CNL patterns | `Ion has headache.` |
| `E_CNL_AMBIGUOUS` | Multiple valid parses | Rare if grammar is correct |

### DSL Parsing Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_DSL_SYNTAX` | General DSL syntax error | `@rule1 ForAll Cell c` (missing `graph`) |
| `E_DSL_TWO_AT` | Two `@` tokens on one line | `@x P @y` |
| `E_DSL_AT_IN_EXPR` | `@` inside expression | `Implies @a @b` |
| `E_DSL_AT_NOT_FIRST` | `@` not at start of line (alias of `E_DSL_AT_IN_EXPR`) | `P(@x)` |
| `E_DSL_UNBOUND_VAR` | `$x` used outside scope | `geneA $x` |
| `E_DSL_FORBIDDEN_PAREN` | Parentheses used | `Pred(a, b)` |
| `E_DSL_FORBIDDEN_BRACKET` | Brackets used | `Pred[a]` |
| `E_DSL_FORBIDDEN_SEMICOLON` | Semicolons used | `a; b` |
| `E_DSL_REDECLARATION` | Same `@name` declared twice | `@a __Atom` twice |
| `E_DSL_MISSING_RETURN` | Block without `return` | `ForAll ... end` |
| `E_DSL_MISSING_END` | Block without `end` | Unclosed `ForAll` |
| `E_DSL_ORPHAN_KB_NAME` | `@:name` without preceding expr | `@:foo` |

### Vocabulary / Typing Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_UNKNOWN_SYMBOL` | Bare name not in vocabulary | `unknownPred c0` |
| `E_UNKNOWN_TYPE` | Domain/type not declared | `IsA x UnknownType` |
| `E_UNKNOWN_PREDICATE` | Predicate not in lexicon | `mystery c0` |
| `E_ARITY_MISMATCH` | Wrong number of arguments | `geneA c0 c1` (arity=1) |
| `E_TYPE_MISMATCH` | Argument type doesn't match | `geneA ion` (expects Cell) |
| `E_TYPE_CONFLICT` | Same name, different types | `IsA x Cell` and `IsA x Person` |
| `E_RESERVED_WORD` | Vocabulary uses reserved keyword | Domain named "true" |

### Translation Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_TRANSLATE_AMBIGUOUS` | Multiple possible translations | Unlikely |
| `E_TRANSLATE_UNSUPPORTED` | Construct not in target | Future extensions |
| `E_CNL_PATTERN_MISSING` | CNL phrase has no mapping in the fixed patterns | "has headache" |

### Schema Engine Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_SCHEMA_INVALID` | Malformed schema definition | - |
| `E_SCHEMA_LIMIT` | Instantiation budget exhausted | >1000 iterations |

### Lowering / Fragment Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_UNSUPPORTED_FRAGMENT` | Fragment has no backend | `Frag_QuantumTensor` |
| `E_UNSUPPORTED_OPERATOR` | Operator cannot be lowered | - |

### Backend / Certificate Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_BACKEND_CRASH` | Backend process died | SAT solver segfault |
| `E_BACKEND_UNSUPPORTED` | Backend doesn't support goal | MaxSAT on SAT-only backend |
| `E_BACKEND_TIMEOUT` | Backend exceeded time budget | - |
| `E_CERT_MISSING` | No certificate provided | UNSAT without DRAT |
| `E_CERT_INVALID` | Certificate verification failed | Corrupted DRAT proof |
| `E_CERT_UNSUPPORTED_FORMAT` | No checker for format | Alethe without checker |
| `E_CERT_DIGEST_MISMATCH` | Certificate for different problem | Wrong problemDigest |

### Check Errors

| Code | Condition | Example |
|------|-----------|---------|
| `E_CHECK_DISPROVED` | A `Check` obligation is false | Theorem does not follow |
| `E_CHECK_UNKNOWN` | A `Check` obligation could not be proved | Backend returned `UNKNOWN` |

## Diagnostics for UNKNOWN

When returning `UNKNOWN`, include structured diagnostics:

```typescript
interface UnknownDiagnostic {
  status: "UNKNOWN";
  reason: 
    | "BUDGET_EXHAUSTED"
    | "CERT_MISSING" 
    | "UNSUPPORTED_ROUTE"
    | "APPROX_NOT_ALLOWED"
    | "SCHEMA_LIMIT"
    | "SCHEMA_EVAL_UNSUPPORTED";
  planSummary?: string;
  backendAttempts?: BackendAttempt[];
}

interface BackendAttempt {
  backendId: string;
  status: "UNKNOWN" | "ERROR";
  notes?: string;
}
```

## Explainability Diagnostics

### Unsat Cores
For `UNSAT`/`PROVED` results:
- Include `OriginId[]` for contributing constraints
- Provide narrative linking core to query

### Counterexamples
For `SAT`/`DISPROVED` results:
- Include model/trace
- Project into user vocabulary (decode BV, name entities)
- Link to origins that allowed the counterexample

## Example Error Reports

### Example 1: DSL Two-@ Error
```text
ok: false
error.kind: ParseError
error.code: E_DSL_TWO_AT
error.message: Only one '@' token allowed per line.
error.blame: UserInput
error.origin:
  sourceId: input-001
  line: 5
  column: 12
  snippet: @ion likes @maria
  format: DSL
error.details:
  hint: Use bare 'maria' if it is a vocabulary constant, or '$maria' if it is a variable.
```

### Example 2: Unknown Symbol
```text
ok: false
error.kind: VocabError
error.code: E_UNKNOWN_SYMBOL
error.message: Symbol 'unknownPred' not found in vocabulary.
error.blame: TheoryFile
error.origin:
  sourceId: bio.sys2
  path: theories/bio.sys2
  line: 15
  column: 1
  snippet: unknownPred c0
  format: DSL
error.details:
  got: unknownPred
  hint: Add 'unknownPred' to the schema vocabulary or check spelling.
```

### Example 3: Type Mismatch
```text
ok: false
error.kind: TypeError
error.code: E_TYPE_MISMATCH
error.message: Argument type mismatch: expected 'Cell', got 'Person'.
error.blame: UserInput
error.origin:
  sourceId: input-002
  line: 1
  column: 7
  snippet: geneA ion
  format: DSL
error.details:
  expected: Cell
  got: Person
  hint: Predicate 'geneA' expects a Cell argument.
```

## Test Cases

The test suite must verify:

| Input | Expected Code | Expected Blame |
|-------|---------------|----------------|
| `@x P @y` (DSL) | `E_DSL_TWO_AT` | `UserInput` |
| `unknownPred c0` | `E_UNKNOWN_SYMBOL` | `TheoryFile` |
| `geneA c0 c1` | `E_ARITY_MISMATCH` | `UserInput` |
| `geneA ion` | `E_TYPE_MISMATCH` | `UserInput` |
| `For all c: P($c).` (CNL) | `E_CNL_MISSING_DOMAIN` | `UserInput` |
| UNSAT without DRAT | `E_CERT_MISSING` | `Backend` |
| Wrong problemDigest | `E_CERT_DIGEST_MISMATCH` | `System` |

## References

- DS-005 (CNL lexicon and typing)
- DS-008 (DSL grammar)
- DS-009 (origins and sessions)
- DS-011 (certificate policy)
- DS-014 (certificate formats)
- DS-018 (translation errors)
