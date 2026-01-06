# Agent Guidelines for UBHNL

## DSL (Intermediate Representation) Restrictions
The DSL serves as the rigid, semantic graph (DAG) underlying all logic. It is NOT for human convenience but for structural clarity and auditability.

2.  **Strict Graph Structure**:
    *   Every complex expression MUST be decomposed into a DAG of named nodes.
    *   **Prohibited**: Deeply nested expressions like `implies(and(a, b), c)` as a single statement.
    *   **Required**: SSA-like flattening.
        ```dsl
        @t1 = and($a, $b)
        @root = implies($t1, $c)
        ```

3.  **Statement Format**:
    *   Strictly: `@variable Verb Param1 Param2 ...`
    *   **No Equal Sign**: Assignment is implied by position.
    *   **No Parentheses**: Arguments are space-separated.
    *   **Blocks**: Use `@var Verb Args begin ... end` for scopes.
    *   `Verb` is the operator (e.g., `and`, `forall`, `implies`).
    *   `Parameters` are references to other variables (`$t1`) or constants.


4.  **No "Syntactic Sugar"**:
    *   No infix operators (`a implies b`).
    *   No implicit variable creation.

## CNL (Controlled Natural Language) Guidelines
1.  **Map to DAG**: The CNL parser's job is to read "natural" sentences and explode them into the rigorous DSL DAG.
2.  **Flexibility**: CNL can look like English (Subject-Verb-Object), Math, or Logic, but it must translate deterministicly.
