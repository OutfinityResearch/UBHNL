# DS-006: NL Parsing and Typed AST Pipeline

## Goal
Specify the pipeline that converts CNL input into a typed AST suitable for UBH compilation.

## Position in the System
The “NL pipeline” is intentionally split into:
- **CNL surface parsing** (DS-005): string → CST/surface AST
- **DSL/semantic IR** (DS-008): canonical representation for learn/query statements
- **typed core logic AST** (this DS): small, stable semantic interface for compilation (DS-007)

The compiler (DS-007) should not care whether the source was CNL or DSL.

## Pipeline Stages (CNL → Typed AST)
1) Load lexicon (JSON) and build a symbol table (domains, constants, predicates, aliases).
2) Tokenize input (keywords, identifiers, punctuation).
3) Parse tokens to a **concrete syntax tree** (CST).
4) Normalize:
   - keyword casing,
   - alias expansion (surface → canonical symbol),
   - punctuation sugar (`->` → `implies`, `!` → `not`, etc.).
5) Build a **surface AST** that preserves source locations (for errors).
6) Resolve symbols and build a **typed AST**:
   - bind variables introduced by quantifiers,
   - resolve constants and predicate names,
   - validate arity and argument types.
7) Desugar to a small **core logic AST**:
   - `forall, exists, and, or, not, implies`
   - optional `iff`, `eq`, `bool literals`

## Typed Core Logic AST (Reference)
This AST is the contract between front-ends and the UBH compiler.

### Expr Nodes
- `ForAll(var: Var, domain: Domain, body: Expr)`
- `Exists(var: Var, domain: Domain, body: Expr)`
- `And(lhs: Expr, rhs: Expr)`
- `Or(lhs: Expr, rhs: Expr)`
- `Not(expr: Expr)`
- `Implies(lhs: Expr, rhs: Expr)`
- `Pred(name: PredSym, args: Term[])`
- `BoolLit(value: true|false)` (optional)
- `Eq(lhs: Term, rhs: Term)` (optional; mostly useful for enums/bitvectors)

### Terms
- `VarRef(var: Var)` where `var` is introduced by a quantifier binder
- `ConstRef(name: string, type: Domain)`

## Beyond Core Logic (Other Fragments)
This DS defines the *minimal* typed AST needed for deterministic CNL and UBH compilation.

For universal reasoning, other front-ends may produce richer semantic IRs targeting other fragments
(SMT, QBF, TS, CHC, optimization, probabilistic inference). The orchestrator classifies those problems
using DS-010 and dispatches to backends per DS-011/DS-012.

Design rule:
- CNL remains deterministic and small; richer languages should be separate front-ends that still attach origins and types.

## Symbol Resolution Rules
Given a lexicon `L`:
- A predicate call `P(t1,...,tn)` is valid iff:
  - `P` exists in `L.predicates`,
  - `arity(P)=n`,
  - each term `ti` resolves to a type compatible with `args(P)[i]`.
- A term `t` resolves as:
  1) a bound variable if it is in the current quantifier environment, else
  2) a constant if it exists in `L.constants`, else
  3) error: unknown identifier.

## Error Handling (Required)
Errors must be deterministic, categorized, and include source positions.

### Categories
Error payloads must follow DS-016. The NL pipeline must at minimum distinguish:
- `ParseError`: violates the grammar (DS-005), unexpected token, invalid punctuation.
- `LexiconError` / `VocabError`: unknown predicate/domain/constant, unknown alias, unknown identifier.
- `TypeError`: arity mismatch, argument type mismatch, domain mismatch.

### Policy
- Unknown symbols or type mismatches are hard errors.
- Ambiguous parses are rejected with a clear message and a suggestion (e.g., “add parentheses”).

## Example (CNL → Typed AST)
Input:
`for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)`

Normalized core form:
`forall c in Cell: implies(and(geneA(c), not(inhibitor(c))), proteinP(c))`

Typed AST (shape only):
`ForAll(c:Cell,
  Implies(
    And(Pred(geneA,[VarRef(c)]), Not(Pred(inhibitor,[VarRef(c)]))),
    Pred(proteinP,[VarRef(c)])
  )
)`

## Rationale
The typed AST isolates language concerns from the UBH kernel and provides a stable contract for compilation.
