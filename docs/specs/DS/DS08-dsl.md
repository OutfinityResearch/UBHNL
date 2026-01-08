# DS-008: DSL (sys2) - Syntax and Semantics

## Goal

Define the **DSL** (Domain-Specific Language) with extension `.sys2`, the canonical machine-friendly format for:
- Long-term theory files on disk
- Reproducible session inputs for `learn(...)` / `query(...)`
- Version control and diffing
- Target of CNL translation

## Design Principles (Non-Negotiable)

1. **Deterministic**: Same input always produces same AST.
2. **Strict vocabulary**: Unknown bare identifiers are load errors.
3. **Explicit declaration**: Working-memory names use `$`; persistent KB/vocabulary names are bare.
4. **No parentheses/brackets**: `()` and `[]` are FORBIDDEN in syntax.
5. **Composition via naming**: Complex expressions built by naming parts with `@`.
6. **Anonymous grouping**: Use braces `{ }` for inline anonymous expressions.
7. **Single `@` rule**: `@` appears only at declaration, NEVER inside expressions.

## File Format

- **Extension**: `.sys2`
- **Encoding**: UTF-8
- **Line ending**: LF (Unix-style)
- **Comments**: `#` or `//` to end of line (both forms supported)
- **Indentation**: Spaces (2 or 4), significant only inside blocks

---

# PART 1: Lexical Elements

## 1.1 Identifiers

```
IDENT := [a-zA-Z_][a-zA-Z0-9_]*
```

Case-sensitive. Examples: `Person`, `HasFever`, `c0`, `rule1`

## 1.2 Reserved Keywords

```
ForAll  Exists  graph  end  return
And  Or  Not  Implies  Iff  Xor
true  false
IsA  __Atom
Weight  ProbQuery  Ask  Given
load
Vocab  Domain  Const  Pred  Func
SubType  Alias
Proof  Given  Assume  Apply  Derive  Observed  Hypothesis  Verify  Constraint  Contradiction  Query  Found  Therefore
Note
Assert  Check
```

## 1.3 Number Literals (for probabilistic weights)

```
NUMBER := DIGIT+ ("/" DIGIT+)? | DIGIT+ "." DIGIT+
```

Examples: `3/10`, `1/2`, `0.8`, `12.5`

## 1.3.1 String Literals (for proof notes)

```
STRING := "\"" (CHAR | ESC)* "\""
```

Examples: `"Modus Ponens on 1,2"`, `"Contradiction: ..."`

## 1.4 Special Tokens

| Token | Meaning |
|-------|---------|
| `@` | Variable/expression declaration (beginning of statement only) |
| `$` | Reference to a working-memory name (bound variable or named expression) |
| `:` | KB storage name / type annotation |
| `{ }` | Anonymous expression grouping |
| `#` or `//` | Comment to end of line (both forms supported) |

## 1.5 FORBIDDEN Tokens

| Token | Reason | Handling |
|-------|--------|----------|
| `( )` | Use space-separated args or `{ }` | Error (see DS-016) |
| `[ ]` | Reserved for future use | Error (see DS-016) |
| `;` | Newlines separate statements | Error (see DS-016) |

---

# PART 2: Core Syntax Rules

## Rule 0: Theory Loading with `load`

DSL files can include other theory files:

```sys2
load "../theories/domains/medical.sys2"
load "../theories/core/logic.sys2"
load "helpers/common.cnl"
```

### Syntax

```
load "<relative-path>"
```

### Path Resolution Rules

| Rule | Description |
|------|-------------|
| **Relative to current file** | Path is resolved relative to the directory containing the current file |
| **No absolute paths** | Absolute paths are **FORBIDDEN** (see DS-016) |
| **Both formats supported** | Can load `.sys2` or `.cnl` files |
| **Extension required** | Must include `.sys2` or `.cnl` extension |

### Format-Specific Behavior

| Format | Behavior |
|--------|----------|
| `.sys2` | Loaded **directly** into kernel (no translation) |
| `.cnl` | **Translated to DSL** first, then loaded |

### Examples

```sys2
# File: /project/cases/patient_case.sys2

load "../theories/domains/medical.sys2"   # OK - load DSL directly
load "../theories/domains/family.cnl"     # OK - translate CNL then load
load "local/helpers.sys2"                 # OK - subdirectory

# FORBIDDEN:
# load "/absolute/path/file.sys2"         # ERROR: absolute paths are forbidden (see DS-016)
```

### Semantics

1. **Declarations merge**: All `@name` declarations from loaded file become available
2. **KB names available**: Names with `:kbName` are accessible as bare identifiers
3. **Order preserved**: Multiple loads processed in declaration order
4. **Idempotent**: Loading same file twice has no effect (deduplication by path)
5. **No shadowing**: A KB name may be introduced only once across all loaded files
6. **Conflict policy**: If two files introduce the same KB name or predicate with different meaning, it is a hard error (see DS-016)
7. **No automatic namespaces**: Use explicit name prefixes (e.g., `Medical_Patient`) or explicit aliases (`Alias local global`) to avoid collisions
8. **Circular detection**: Circular loads reported as an error (see DS-016)

---

## Rule 0A: Vocabulary Block (Canonical Schema)

Sys2 files may declare an explicit vocabulary block. This is the **canonical** source of
predicate/function signatures and alias mappings.

```sys2
Vocab
    Domain Person
    Domain Cell
    Const Alice Person
    Const c0 Cell
    Pred Trusts Person Person
    Pred Active Person
    Func Age Person Int
    SubType Patient Person
    Alias localPatient Patient
end
```

Rules:
- `Domain` declares a type/domain.
- `Const` declares a constant and its domain.
- `Pred` declares a boolean predicate signature (arity = number of types listed).
- `Func` declares a function signature; the **last type** is the return type, preceding types are arguments.
- `SubType A B` means `A` is a subtype of `B` (see Rule 12).
- `Alias local global` creates a local alias for an existing KB name.

Legacy support:
- `@name:kbName __Atom` + `IsA` may be used as a fallback schema source, but `Vocab` is normative.

## Rule 0A.1: Multiple Vocab Blocks

A single file may contain **multiple** `Vocab ... end` blocks. They are merged additively:

```sys2
Vocab
    Domain Person
    Const Alice Person
end

# ... other statements ...

Vocab
    Domain Cell
    Pred Expresses Cell Protein
end
```

Rules:
- Multiple `Vocab` blocks are merged at load time
- Duplicate declarations are errors
- Order of blocks does not matter (merge is additive)

## Rule 0A.2: Empty Vocab Blocks

An empty `Vocab ... end` block is valid and has no effect:

```sys2
Vocab
end
```

This is useful in generated code where the vocabulary may be conditionally empty.

## Rule 0A.3: Blank Lines in Blocks

Blank lines are allowed inside any block (including `ForAll`, `Exists`, `Vocab`, `Proof`, etc.) and are treated as no-ops:

```sys2
@rule1 ForAll Person graph x

    @c1 HasFever $x

    @c2 IsSick $x
    @and And $c1 $c2
    return $and
end
```

Blank lines have no semantic effect and are equivalent to comments.

---

## Rule 1: Variable Declaration with `@`

Every named entity must be declared **exactly once** with `@`:

```sys2
@TypeName:TypeName __Atom   # Declare a type/domain (KB name)
@constName:ConstName __Atom # Declare a constant (KB name)
@tmp __Atom                 # Declare a working-memory constant
@exprName Predicate...      # Declare a named expression
```

**Invariant**: Each `@name` appears exactly once in the entire theory.

Note: `@... __Atom` and `IsA` are legacy schema forms; prefer `Vocab` declarations for new files.

## Rule 1B: Working Memory vs KB Names

Use `:` to control whether a name is **temporary** or **persistent**:

- `@tmp __Atom` or `@tmp expr` defines a **working-memory name**; reference it as `$tmp`.
- `@tmp:kbName __Atom` or `@tmp:kbName expr` defines a **KB/vocabulary name**; reference it as `kbName` (bare).
- Prefer `:kbName` for important facts, lemmas, or theorems so proofs/explanations stay compact.

## Rule 1C: SubType and Alias Statements (Top-Level)

Outside of `Vocab`, the following statements are allowed:

```sys2
SubType Patient Person
Alias localPatient Patient
```

Rules:
- `SubType A B` declares `A <: B` (see Rule 12).
- `Alias local global` creates a local alias for an existing KB name in the current file.

## Rule 2: `$` References Only Working-Memory Names

Use `$` only for:
- **bound variables** introduced by `graph`, and
- **working-memory names** declared with `@name expr` or `@name __Atom`.

KB/vocabulary names are referenced **bare**.

```sys2
@alice __Atom
@bob __Atom
@f1 Trusts $alice $bob       # working-memory names use $

@Alice:Alice __Atom
@Bob:Bob __Atom
@f2 Trusts Alice Bob          # KB names are bare

@rule1 ForAll Person graph p
    @c1 HasFever $p
    @c2 IsSick $p
    @imp Implies $c1 $c2
    return $imp
end
```

## Rule 3: `@` NEVER Inside Expressions

The `@` token is **forbidden** inside any expression. It can only appear at the **beginning of a line** to declare a new name.

```sys2
# CORRECT - @ at beginning
@f1 Trusts $alice $bob

# WRONG - @ inside expression
Trusts @alice @bob        # ERROR: @ is not allowed inside expressions (see DS-016)
@rule Implies @a @b       # ERROR: @ is not allowed inside expressions (see DS-016)
```

## Rule 4: KB Storage with `:`

To save an expression to the Knowledge Base with a vocabulary name:

```sys2
@exprName:kbName Predicate args
```

Or to name the preceding anonymous expression:

```sys2
Implies $a $b
@:myImplication           # Names previous line as "myImplication" in KB
```

## Rule 4A: Anonymous Fact Assertions

An expression without an `@` declaration is an **anonymous fact** and is automatically asserted:

```sys2
HasFever Alice            # Anonymous fact - auto-asserted
Trusts Alice Bob          # Anonymous fact - auto-asserted
```

This is equivalent to:
```sys2
@_anon1 HasFever Alice
Assert $_anon1
@_anon2 Trusts Alice Bob
Assert $_anon2
```

Anonymous facts are useful for simple statements but cannot be referenced later. Use `@name` declarations for facts that need to be referenced in rules or proofs.

## Rule 4B: Numeric Literals as Constants

Numbers are valid constants anywhere in DSL expressions:

```sys2
Age Alice 25              # 25 is a numeric constant
Temperature $p 38.5       # Decimal allowed
Priority $task 1/2        # Rational allowed
```

Rules:
- Integers, decimals, and rationals are all valid
- Numbers are treated as constants (not variables)
- Number comparison/arithmetic requires appropriate predicates (e.g., `LessThan`, `Add`)

## Rule 5: Predicate and Function Application (Space-Separated)

Predicates and functions are applied with **space-separated** arguments. **NO PARENTHESES**.

```sys2
Predicate arg1 arg2 arg3
```

Examples:
```sys2
HasFever Alice         # Unary predicate (KB constant)
Trusts $u $v           # Binary predicate (working-memory names)
Between $x $y $z       # Ternary predicate (bound variables)
```

Zero-arity predicates are allowed when declared in the vocabulary:
```sys2
Enabled
```

Function application uses the same syntax and is disambiguated by vocabulary signatures:
```sys2
Age Alice
Succ $n
```
Parsing may be vocabulary-aware to resolve whether an identifier is a predicate or a function.

## Rule 6: Anonymous Grouping with `{ }`

Use braces `{ }` for inline anonymous sub-expressions:

```sys2
@rule1 Implies { And $a $b } { Or $c $d }
```

This is semantically equivalent to:
```sys2
@tmp1 And $a $b
@tmp2 Or $c $d
@rule1 Implies $tmp1 $tmp2
```

Braces can nest:
```sys2
@complex Implies { And $a { Or $b $c } } $d
```

## Rule 7: Anonymous Statements (No `@`)

A statement without `@` creates an anonymous assertion:

```sys2
HasFever Alice         # Anonymous fact (KB constant)
Implies $c1 $c2        # Anonymous rule (named expressions)
```

## Rule 8: Operator Precedence

When braces `{ }` are omitted, operators have the following precedence (highest to lowest):

| Precedence | Operator | Associativity |
|------------|----------|---------------|
| 4 (highest) | `Not` | prefix |
| 3 | `And` | left |
| 2 | `Or`, `Xor` | left |
| 1 (lowest) | `Implies`, `Iff` | right |

**Example without braces**:
```sys2
@r1 Implies Not $a And $b Or $c $d
```

Is parsed as:
```sys2
@r1 Implies { Or { And { Not $a } $b } $c } $d
```

**Recommendation**: Always use `{ }` for clarity. Precedence rules exist for compatibility but explicit grouping is preferred.

---

# PART 3: Statement Types

## 3.0 Vocabulary Block

See Rule 0A for canonical schema declarations. The `Vocab` block is preferred over legacy `__Atom` + `IsA` declarations.

## 3.1 Type/Domain Declaration

```sys2
@TypeName:TypeName __Atom
```

Declares `TypeName` as a domain/type that can contain constants.

Note: `@TypeName __Atom` (without `:TypeName`) is a working-memory name and must be referenced as `$TypeName`.

## 3.2 Constant Declaration

```sys2
# Working memory constant
@tmp __Atom
IsA $tmp TypeName

# Persistent KB constant
@Alice:Alice __Atom
IsA Alice Person
```

Or combined:
```sys2
@Person:Person __Atom
@Alice:Alice __Atom
@Bob:Bob __Atom
IsA Alice Person
IsA Bob Person
```

Note: constants without `:kbName` are working-memory names and must be referenced as `$name`.

## 3.3 Fact Statement

Named fact:
```sys2
@f1 Predicate arg1 arg2
```

Named fact with KB storage:
```sys2
@f1:factName Predicate arg1 arg2
```

Anonymous fact:
```sys2
Predicate arg1 arg2
```

## 3.4 Logical Connectives

| Connective | Syntax | Arity |
|------------|--------|-------|
| Conjunction | `And expr1 expr2 ...` | 2+ |
| Disjunction | `Or expr1 expr2 ...` | 2+ |
| Negation | `Not expr` | 1 |
| Implication | `Implies antecedent consequent` | 2 |
| Biconditional | `Iff expr1 expr2` | 2 |
| Exclusive Or | `Xor expr1 expr2` | 2 |

Examples:
```sys2
@c1 And $a $b $c           # Conjunction of 3
@c2 Or $a $b $c $d         # Disjunction of 4
@c3 Not $a                 # Negation
@c4 Implies $a $b          # Implication
@c5 Iff $a $b              # Biconditional
@c6 Xor $a $b              # Exclusive or
```

## 3.5 Quantified Statements (Block Syntax)

### Universal Quantifier (ForAll)

```sys2
@ruleName ForAll TypeName graph varName
    # body statements here
    @expr1 ...
    @expr2 ...
    return $exprToReturn
end
```

**Rules**:
- `return` statement is **always required** (even for assertion-only blocks, use `return $CONST1`)
- Variable shadowing is **forbidden**: a nested block cannot reuse an outer variable name

**Variable Shadowing Error**:
```sys2
@rule1 ForAll Person graph x
    @inner ForAll Person graph x    # ERROR: variable shadowing is forbidden (see DS-016)
        ...
    end
end
```

Use different variable names:
```sys2
@rule1 ForAll Person graph x
    @inner ForAll Person graph y    # OK: different name
        ...
    end
end
```

Example:
```sys2
@rule1 ForAll Person graph x
    @c1 HasFever $x
    @c2 IsSick $x
    @imp Implies $c1 $c2
    return $imp
end
```

### Existential Quantifier (Exists)

```sys2
@queryName Exists TypeName graph varName
    # body
    return $expr
end
```

### Nested Quantifiers

```sys2
@rule1 ForAll Person graph x
    @inner ForAll Person graph y
        @c1 Trusts $x $y
        @c2 Trusts $y $x
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner
end
```

### Multiple Variables in Same Block

```sys2
@rule1 ForAll Person graph x
    @level2 ForAll Person graph y
        @level3 ForAll Person graph z
            # now $x, $y, $z all in scope
            return $expr
        end
        return $level3
    end
    return $level2
end
```

## 3.6 Definitions (Named Parametric Formulas)

Define a reusable formula with parameters:

```sys2
@definitionName:vocabularyName graph param1 param2 ...
    # body
    return $result
end
```

Example - defining "Producer" property for cells:
```sys2
@Producer:Producer graph c
    @inner ForAll Protein graph p
        @c1 Expresses $c $p
        @c2 Active $p
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner
end
```

Usage:
```sys2
@f1 Producer c0           # Apply definition to KB constant c0
```

## 3.7 Probabilistic Weights and Queries

### Weight Statements
Attach a weight to a **ground literal**:

```sys2
Weight { Cloudy today } 0.8
Weight { Not { Cloudy today } } 0.2
```

Rules:
- the literal must be ground (no bound variables),
- weights are exact rationals or decimals (parsed deterministically as rationals).

### Probabilistic Queries
Define a probabilistic query with an explicit block:

```sys2
@q1 ProbQuery
    Ask { Rain today }
    Given { Cloudy today }
end
```

`Given` is optional; when omitted, the query is unconditional.

## 3.8 Proof Blocks

Proof blocks serialize CNL proofs into DSL form for storage and checking.

**See DS-020 for the complete proof format specification.**

## 3.9 Assert / Check Statements

Explicit assertion and obligation forms:
```sys2
Assert { Implies $a $b }
Check { Implies $a $b }

@rule1 Implies $a $b
Assert $rule1

@T1 Check { Implies { And $g1 $g2 } $c }
```

Semantics:
- `Assert expr` is equivalent to an anonymous assertion `expr` (adds a constraint).
- `Check expr` is an **obligation**; it is **not** added as a constraint.
  The session must attempt to prove it at load/learn time (DS-009).

Notes:
- `@name expr` defines a **working-memory name** and must be referenced as `$name`.
- `@name:kbName expr` defines a **KB/vocabulary name** and is referenced as `kbName` (bare).
- Both `Assert { expr }` and `Assert $name` are valid; use braces for inline expressions and `$name`
  when referencing a named expression.

Legacy behavior:
- A top-level `expr` or `@name expr` is treated as an implicit `Assert` unless it appears inside
  a `Definition` or `Proof` block.

---

# PART 4: Complete Grammar (EBNF)

This section is a **summary**. The complete grammar is defined in **DS-022**.

```ebnf
program      := (statement)* ;

statement    := declaration
              | typing
              | namedExpr
              | anonExpr
              | assertStmt
              | checkStmt
              | vocabBlock
              | aliasDecl
              | subtypeDecl
              | quantified
              | definition
              | probWeight
              | probQuery
              | kbNaming
              | proofBlock
              | COMMENT ;

vocabBlock   := "Vocab" (vocabStmt)* "end" ;
vocabStmt    := "Domain" IDENT
              | "Const" IDENT IDENT
              | "Pred" IDENT (IDENT)*
              | "Func" IDENT (IDENT)+
              | "SubType" IDENT IDENT
              | "Alias" IDENT IDENT ;

aliasDecl    := "Alias" IDENT IDENT ;
subtypeDecl  := "SubType" IDENT IDENT ;

declaration  := "@" IDENT (":" IDENT)? "__Atom" ;

typing       := "IsA" term IDENT ;

namedExpr    := "@" IDENT (":" IDENT)? expr ;

anonExpr     := expr ;

kbNaming     := "@" ":" IDENT ;

quantified   := "@" IDENT (":" IDENT)? quantifier IDENT "graph" IDENT
                    (statement)*
                    "return" "$" IDENT
                "end" ;

definition   := "@" IDENT ":" IDENT "graph" (IDENT)+
                    (statement)*
                    "return" "$" IDENT
                "end" ;

probWeight   := "Weight" "{" literal "}" NUMBER ;

probQuery    := "@" IDENT (":" IDENT)? "ProbQuery"
                    "Ask" "{" expr "}"
                    ("Given" "{" expr "}")?
                "end" ;

proofBlock   := "@" IDENT (":" IDENT)? "Proof"
                    (proofSection)+
                "end" ;

proofSection := ("Given"|"Assume"|"Apply"|"Derive"|"Observed"|"Hypothesis"|
                 "Verify"|"Constraint"|"Contradiction"|"Query"|"Found"|"Therefore")
                 proofStmt+ ;

proofStmt    := expr
              | "Note" STRING ;

assertStmt   := "Assert" expr ;
checkStmt    := "Check" expr ;

quantifier   := "ForAll" | "Exists" ;

expr         := connective
              | predApply
              | term ;

connective   := "And" term term (term)*
              | "Or" term term (term)*
              | "Not" term
              | "Implies" term term
              | "Iff" term term
              | "Xor" term term ;

predApply    := IDENT (term)* ;

literal      := predApply
              | "Not" "{" predApply "}" ;

term         := "$" IDENT              # bound variable or named expression reference
              | IDENT                  # constant/predicate from vocabulary
              | NUMBER                 # numeric literal
              | "true" | "false"       # boolean literals
              | "{" expr "}" ;         # anonymous grouping

NUMBER       := DIGIT+ ("/" DIGIT+)? | DIGIT+ "." DIGIT+ ;

IDENT        := [a-zA-Z_][a-zA-Z0-9_]* ;
COMMENT      := "#" .* EOL ;
```

---

# PART 5: Scope and Semantic Rules

## 5.1 Scope Rules

| Declaration Form | Scope |
|-----------------|-------|
| `@name __Atom` | Global (entire theory, working memory) |
| `@name:kbName __Atom` | Global (entire theory, KB/vocabulary) |
| `graph varName` in block | Local to containing block |
| `@localExpr ...` inside block | Local to containing block |

Inside a `ForAll`/`Exists` block, the graph variable is in scope for all nested content.

## 5.2 Reference Resolution

1. `$name` looks up **working-memory names** in scope (bound variables or local named expressions)
2. If not found locally, looks in enclosing scopes
3. If still not found, error (see DS-016)
4. Bare identifiers resolve **only** to KB/vocabulary names (after alias expansion)

Alias rule:
- `Alias local global` binds `local` to the existing KB name `global` for the current file.

## 5.3 Type Checking

1. `IsA const Type` requires both `const` and `Type` declared
2. Predicate arguments must match types from the vocabulary schema
3. Function arguments and return types must match declared signatures
4. Quantifier domain must be a declared type
5. Subtyping: if `SubType A B`, then any `A` is also a valid `B`

## 5.4 Operator Precedence

DSL uses **explicit grouping** with `{ }`. When braces are used, there is no ambiguity. For expressions without braces (simple predicate applications), parsing is left-to-right.

Note: Unlike CNL, DSL does not rely on operator precedence rules. All complex expressions should use `{ }` for grouping.

## 5.5 KB Storage Semantics

| Syntax | Effect |
|--------|--------|
| `@name expr` | Creates named expression, NOT stored in KB |
| `@name:kbName expr` | Creates AND stores in KB as `kbName` |
| `@:kbName` (after expr) | Stores preceding expression in KB |

## 5.6 Empty Domain Semantics

| Quantifier | Empty Domain | Result |
|------------|--------------|--------|
| `ForAll X graph x: P` | `true` | Vacuously true |
| `Exists X graph x: P` | `false` | No witness exists |

## 5.7 Variable Shadowing Policy

Variable shadowing in nested blocks is **forbidden**. If an inner block tries to bind a variable with the same name as an outer block, it is an error (see DS-016).

Example (error):
```sys2
@rule1 ForAll Person graph x
    @inner ForAll Person graph x    # ERROR: shadows outer x
        ...
    end
end
```

Use distinct variable names in nested quantifiers.

---

# PART 6: Examples

## Example 1: Boolean Basics

**CNL**:
```cnl
Let a be a Bit.
Let b be a Bit.
Let c be a Bit.

If a then b.
If b then c.
```

**DSL**:
```sys2
Vocab
    Domain Bit
    Const a Bit
    Const b Bit
    Const c Bit
end

@rule1 Implies a b
@rule2 Implies b c
```

## Example 2: Family Relations

**CNL**:
```cnl
Let Person be a Domain.
Let p1 be a Person.
Let p2 be a Person.
Let p3 be a Person.

p1 is Parent of p2.
p2 is Parent of p3.

For all Person x, Person y, Person z:
    If $x is Parent of $y and $y is Ancestor of $z then $x is Ancestor of $z.
    If $x is Parent of $y then $x is Ancestor of $y.
```

**DSL**:
```sys2
Vocab
    Domain Person
    Const p1 Person
    Const p2 Person
    Const p3 Person
end

@f1 Parent p1 p2
@f2 Parent p2 p3

@rule1 ForAll Person graph x
    @inner1 ForAll Person graph y
        @inner2 ForAll Person graph z
            @c1 Parent $x $y
            @c2 Ancestor $y $z
            @and1 And $c1 $c2
            @c3 Ancestor $x $z
            @imp1 Implies $and1 $c3
            return $imp1
        end
        return $inner2
    end
    return $inner1
end

@rule2 ForAll Person graph x
    @inner3 ForAll Person graph y
        @c4 Parent $x $y
        @c5 Ancestor $x $y
        @imp2 Implies $c4 $c5
        return $imp2
    end
    return $inner3
end
```

## Example 3: Medical Diagnosis

**DSL**:
```sys2
Vocab
    Domain Patient
    Const p1 Patient
end

@rule1 ForAll Patient graph p
    @c1 HasFlu $p
    @c2 HasFever $p
    @imp1 Implies $c1 $c2
    return $imp1
end

@rule2 ForAll Patient graph p
    @c3 HasFlu $p
    @c4 Coughs $p
    @imp2 Implies $c3 $c4
    return $imp2
end

@rule3 ForAll Patient graph p
    @c5 HasCold $p
    @c6 Coughs $p
    @imp3 Implies $c5 $c6
    return $imp3
end

@f1 HasFever p1
@f2 Coughs p1
```

## Example 4: Compact Form with Braces

Instead of many named intermediates, use braces for inline composition:

```sys2
Vocab
    Domain User
    Const Alice User
    Const Bob User
end

@rule1 ForAll User graph x
    @inner ForAll User graph y
        @result Implies { And { Trusts $x $y } { Knows $x $y } } { Friends $x $y }
        return $result
    end
    return $inner
end
```

## Example 5: Definition with KB Storage

```sys2
# Define "Producer" - a cell that activates all proteins it expresses
@Producer:Producer graph c
    @inner ForAll Protein graph p
        @c1 Expresses $c $p
        @c2 Active $p
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner
end

# Use the definition
Vocab
    Domain Cell
    Domain Protein
    Const c0 Cell
end

@f1:c0IsProducer Producer c0
```

---

# PART 7: Error Codes

Error codes are defined in DS-016. This document only describes the conditions that trigger
errors; refer to DS-016 for the canonical codes and diagnostics.

---

# PART 8: Summary Tables

## Token Rules

| Token | Allowed | Where |
|-------|---------|-------|
| `@` | Yes | Beginning of line only (declaration) |
| `$` | Yes | Inside expressions (working-memory names) |
| `{ }` | Yes | Inline anonymous grouping |
| `:` | Yes | After `@name` for KB storage |
| `( )` | **NO** | Forbidden everywhere |
| `[ ]` | **NO** | Forbidden everywhere |

## Statement Patterns

| Pattern | Meaning |
|---------|---------|
| `Vocab ... end` | Canonical vocabulary declarations |
| `@name __Atom` | Declare working-memory type/constant |
| `@name:kbName __Atom` | Declare KB/vocabulary type/constant |
| `IsA const Type` | Type membership |
| `@name expr` | Named expression (local) |
| `@name:kbName expr` | Named + stored in KB |
| `@:kbName` | Store previous in KB |
| `expr` (no @) | Anonymous assertion |
| `ForAll T graph v ... end` | Universal quantifier block |
| `Exists T graph v ... end` | Existential quantifier block |
| `SubType A B` | Subtype declaration (`A <: B`) |
| `Alias local global` | Local alias for existing KB name |
| `Weight { literal } w` | Probabilistic weight annotation |
| `@q ProbQuery ... end` | Probabilistic query block |
| `@p Proof ... end` | Proof block |
| `Assert expr` | Explicit assertion (constraint) |
| `Check expr` | Explicit obligation (prove at load/learn) |

## Comparison with CNL

| Aspect | DSL (sys2) | CNL |
|--------|------------|-----|
| Declaration | `Const Alice Person` (inside `Vocab`) | `Let Alice be a Person.` |
| Type assoc | (included in `Const`) | (included in declaration) |
| Fact | `HasFever Alice` | `Alice has Fever.` |
| Quantifier | `ForAll Person graph x ... end` | `For all Person x: ...` |
| Variable ref | `$x` | `$x` |
| Implication | `Implies $a $b` | `If a then b.` |
| Grouping | `{ And $a $b }` | `a and b` |
| Comments | `# comment` | `// comment` |
| Statement end | Newline | Period `.` |

---

# References

- DS-005 (CNL syntax - aligned subset)
- DS-006 (typed AST - shared representation)
- DS-009 (sessions, origins, holes)
- DS-016 (error handling)
- DS-018 (CNL ↔ DSL translator)
- DS-019 (reserved keywords)
