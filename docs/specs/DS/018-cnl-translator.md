# DS-018: CNL to DSL Translator

## Goal
Implement a standalone component `src/cnlTranslator` that compiles Universal CNL (DS-017) text into strict UBH DSL (DS-008).

## Architecture
1.  **Lexer/Tokenizer**: Breaks text into tokens (Keywords, Identifiers, Indentation).
2.  **Parser**: recursive descent parser that constructs a CST (Concrete Syntax Tree).
3.  **Lowering**: converts CST to AST (Abstract Syntax Tree) matching DSL nodes.
4.  **Codegen**: emits the `.dsl` string.

## Translation Rules (Examples)

| CNL Construct | DSL Output |
| :--- | :--- |
| `If A then B` | `implies(A, B)` |
| `For all T x: P` | `forall($x in T, P)` |
| `Alice knows A` | `knows(Alice, A)` |
| `Eventually A` | `eventually(A)` |

## Interface
```typescript
interface TranslationResult {
    dsl: string;
    errors: ParseError[];
}

function translate(cnlSource: string): TranslationResult;
```

## Testing Strategy
Each test case in `evals/fastEval` shall contain:
- `.cnl` input file.
- `.dsl.expected` file (Gold standard).
- The test runner compares `compile(cnl)` against `dsl.expected`.
