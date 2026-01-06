# DS-005: Controlled Natural Language and Lexicon

## Goal
Define a controlled natural language (CNL) that maps **deterministically** to a **typed logical AST** suitable for UBH compilation.

This DS specifies:
- the *lexicon* contract (what symbols exist and how they are typed),
- the *CNL surface* (what users can write),
- the determinism rules (what is rejected).

## Design Principles (Non-Negotiable)
- **Deterministic parse**: the same input must always produce the same AST, independent of heuristics.
- **Typed**: every predicate argument has a declared finite domain type; type mismatches are hard errors.
- **Explicit scope**: quantifiers and grouping are explicit; no implicit binding or anaphora.
- **Reject ambiguity**: if multiple parses are possible, error out with a message that points to the ambiguous region.
- **Finite domains**: quantifiers range over declared finite domains when lowering to UBH (see DS-003).

## Lexicon (JSON) — Source of Truth
The lexicon defines:
- **domains**: finite sets of symbols (types)
- **constants**: named members of domains
- **predicates**: symbols with arity and argument types
- optional **aliases**: surface forms that map to canonical symbols
 - optional **built-in sorts**: non-enumerated types like integers and bitvectors (used by non-CNL front-ends)

### Lexicon Schema
```json
{
  "version": 1,
  "builtins": {
    "Bool": { "kind": "builtin" },
    "Int": { "kind": "builtin" },
    "Real": { "kind": "builtin" },
    "BV8": { "kind": "bitvector", "width": 8 }
  },
  "domains": {
    "Cell": ["c0", "c1"]
  },
  "constants": {
    "c0": "Cell",
    "c1": "Cell"
  },
  "predicates": {
    "geneA": { "arity": 1, "args": ["Cell"] },
    "inhibitor": { "arity": 1, "args": ["Cell"] },
    "proteinP": { "arity": 1, "args": ["Cell"] }
  },
  "aliases": {
    "gene a": "geneA",
    "protein p": "proteinP"
  }
}
```

### Lexicon Invariants
- Every type referenced in `constants[*]` and `predicates[*].args[*]` must exist in `domains` (finite) or `builtins` (non-finite).
- Every constant must appear in its domain list (or domains must be treated as authoritative and constants derived).
- Predicate names are unique keys; aliases must not conflict with canonical names.
- Canonical symbols must be unique under case-insensitive comparison (so lookup can be case-insensitive deterministically).
- Domains are finite and enumerable.

### Built-in Sorts (When Needed)
The CNL core is designed around finite-domain quantification and predicate logic. For universal reasoning, the system also supports
additional fragments (DS-010) such as SMT bitvectors and arithmetic.

Those fragments typically require built-in (non-enumerated) sorts:
- `Int`, `Real`
- `BVk` (bitvector width `k`)

The lexicon may declare built-in sorts under `builtins` to allow consistent typing across front-ends.

Determinism rule:
- If a front-end uses a sort name, it must be declared either in `domains` (finite) or in `builtins` (non-finite).

### Reserved Keywords
The following tokens are reserved and cannot be used as raw identifiers unless quoted:
`for`, `all`, `exists`, `in`, `if`, `then`, `and`, `or`, `not`, `implies`, `true`, `false`.

## CNL Surface Syntax
### Core Constructs
- Quantifiers: `for all`, `exists`
- Connectors: `and`, `or`, `not`, `implies`
- Conditional sugar: `if <expr> then <expr>` (equivalent to `implies(<expr>, <expr>)`)
- Predicates: `P(t1, ..., tn)` where each `ti` is a term
- Terms:
  - variables introduced by quantifiers (e.g., `c`),
  - constants from the lexicon (e.g., `c0`).

### Lexical Rules
- Keywords are case-insensitive (`For All` == `for all`).
- Identifiers are `[A-Za-z_][A-Za-z0-9_]*` by default.
- Symbol lookup is case-insensitive after alias expansion (canonical casing is preserved for printing).
- Whitespace is insignificant except as a separator.
- Parentheses `(` `)` are allowed for grouping.
- `:` is used to separate a quantifier header from its body (`for all x in D: <body>`).

### Grammar (EBNF)
This grammar is intentionally small; anything outside it is rejected.

```
input        := stmt (NEWLINE stmt)* ;
stmt         := quantified | expr ;

quantified   := quantHead ":" expr ;
quantHead    := ("for" "all" | "exists") binder ("," binder)* ;
binder       := IDENT "in" IDENT | IDENT IDENT ;
               # either: x in Domain
               # or: Domain x   (CNL-friendly)

expr         := implies ;
implies      := orExpr (("implies" | "->") orExpr)* ;
orExpr       := andExpr (("or" | "|") andExpr)* ;
andExpr      := unary (("and" | "&") unary)* ;
unary        := ("not" | "!") unary
             | "if" expr "then" expr
             | atom ;

atom         := "true" | "false"
             | predCall
             | "(" expr ")" ;

predCall     := IDENT "(" args? ")" ;
args         := term ("," term)* ;
term         := IDENT ;
```

Notes:
- Operator precedence is `not` > `and` > `or` > `implies`.
- Even with precedence defined, ambiguous/messy inputs should be rejected with a suggestion to add parentheses.

## Determinism Rules (What We Reject)
The parser/typechecker must reject:
- missing domain for a binder (`for all x: ...`)
- unknown domains (`for all x in Unknown: ...`)
- unknown predicates (`unknownPred(c0)`)
- arity mismatch (`P()` when `arity=1`, `P(a,b)` when `arity=1`)
- type mismatch (`proteinP(person0)` when `proteinP: Cell -> Bool`)
- use of undeclared variables (variable not bound by a quantifier)
- implicit quantification (“every cell …” without an explicit `for all`)
- implicit conjunction/disjunction (missing `and/or`)
- implicit subject/object binding (no pronouns, no “it/they”, no coreference)

## Mapping to Typed Logic AST
The output of CNL parsing is a typed AST in the core logic (DS-006):
- `ForAll(var, domain, body)`
- `Exists(var, domain, body)`
- `And/Or/Not/Implies`
- `Pred(name, args[])`
- `BoolLit(true|false)` (optional)

Symbols are resolved against the lexicon:
- each term becomes either a bound variable or a constant of a known domain type.

## Examples
### Accepted
1) `for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)`
2) `exists person p: has_fever(p) and has_flu(p)`
3) `for all x in Cell: geneA(x) implies proteinP(x)`
4) `(A() and B()) implies C()` (nullary predicates are allowed if declared with `arity=0`)

### Rejected (and why)
1) `for all c: proteinP(c)` (missing domain)
2) `for all cell c: proteinP(x)` (`x` is not bound)
3) `proteinP(c0, c1)` (arity mismatch)
4) `for all person p: proteinP(p)` (type mismatch)
5) `for all cell c: geneA(c) inhibitor(c)` (missing connector between two atoms)

## Rationale
CNL reduces ambiguity and enables deterministic compilation while preserving an NL-like surface.

## Example CNL
- "for all cell c: if geneA(c) and not inhibitor(c) then proteinP(c)"
- "exists person p: has_fever(p) and has_flu(p)"

## Lexicon Format (JSON)
- entities: named constants with a type
- predicates: name + arity + argument types
- domains: finite lists of symbols

Example:
```
{
  "domains": {"Cell": ["c0", "c1"]},
  "entities": {"geneA": "Predicate"},
  "predicates": {
    "proteinP": {"arity": 1, "types": ["Cell"]}
  }
}
```

## Invariants
- All symbols must be declared in the lexicon.
- All quantifiers must include domain and variable names.
- All operators must be explicit (no implicit precedence).

## Rationale
CNL reduces ambiguity and enables deterministic compilation while preserving an NL-like surface.
