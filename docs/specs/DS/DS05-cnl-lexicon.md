# DS-005: Controlled Natural Language (CNL) and Lexicon

## Goal

Define a **Controlled Natural Language (CNL)** that:
- Looks and feels like natural English
- Maps **deterministically** and **bijectively** to the DSL (DS-008)
- Supports multiple styles: fully natural, semi-formal, and explicit
- Is suitable for non-programmers and domain experts
- Is **not** the source of truth for schemas/metadata (use Sys2 for that)

---

# PART 1: Design Principles

## 1.1 Non-Negotiable Rules

1. **Deterministic parse**: Same input always produces same AST
2. **Bijective with DSL**: Every CNL construct maps to exactly one DSL construct
3. **Typed**: Every predicate argument has a declared type
4. **No pronouns**: Anaphoric references (`he`, `she`, `it`, `they`) are FORBIDDEN
5. **No ellipsis**: Incomplete sentences are FORBIDDEN
6. **Finite domains**: Quantifiers range over declared finite domains

## 1.2 Three Styles of CNL

The CNL supports three levels of naturality:

| Style | When to Use | Example |
|-------|-------------|---------|
| **Natural** | Simple single-variable rules | `Every Person with Flu has Fever.` |
| **Semi-formal** | Rules where variables need names | `For any Person x, y: If x trusts y then y knows x.` |
| **Explicit** | Complex multi-variable rules | `For all Person x, Person y, Person z:` |

All three styles translate to the same DSL format.

## 1.3 CNL vs DSL Comparison

| Aspect | CNL (`.cnl`) | DSL (`.sys2`) |
|--------|--------------|---------------|
| **Purpose** | Human authoring | Machine storage |
| **Schema/metadata** | Not authoritative | Canonical |
| **Style** | Natural English | Symbolic |
| **Variables** | Bare: `x`, `person1` | Prefixed: `$x`, `$person1` |
| **Quantifiers** | `Every`, `For any`, `For all` | `ForAll ... graph ... end` |
| **Statements** | End with `.` | End with newline |
| **Comments** | `//` | `#` |
| **Grouping** | Parentheses `()` allowed | Braces `{ }` only |

---

# PART 1A: Theory Loading

## 1A.1 The `load` Directive

CNL files can load other theory files using the `load` directive:

```cnl
load "theories/domains/medical.cnl"
load "theories/core/logic.cnl"
```

### Syntax

```
load "<relative-path>"
```

### Path Resolution Rules

| Rule | Description |
|------|-------------|
| **Relative to current file** | Path is resolved relative to the directory containing the current file |
| **No absolute paths** | Absolute paths are **FORBIDDEN** - use relative paths only |
| **Both formats supported** | Can load `.cnl` or `.sys2` files |
| **Extension required** | Must include `.cnl` or `.sys2` extension |

### Examples

```cnl
// File: /project/cases/patient1.cnl

load "../theories/domains/medical.cnl"   // OK - relative to current file
load "../theories/core/logic.sys2"       // OK - can load .sys2 directly
load "helpers/utils.cnl"                 // OK - subdirectory

// FORBIDDEN:
// load "/absolute/path/file.cnl"        // ERROR: absolute path not allowed
```

### Behavior

- `.cnl` files are **translated to DSL** before loading
- `.sys2` files are loaded **directly** (no translation)
- Circular loads are detected and reported as errors
- Duplicate loads are ignored (idempotent)

### Semantics

1. **Order matters**: Loaded theories are processed before subsequent statements
2. **Namespace merge**: All declarations become available in current context
3. **Idempotent**: Loading same file twice has no additional effect
4. **Type checking**: Loaded declarations are type-checked at load time

### Example

```cnl
// File: patient_diagnosis.cnl
load "theories/domains/medical.cnl"

// Now we can use Patient, Disease, Symptom from medical.cnl
Let p1 be a Patient.
p1 has Flu.
// Rule from medical.cnl applies: If p has Flu then p has Fever.
```

### DSL Equivalent

CNL `load` translates to DSL `load`:
```sys2
load "theories/domains/medical.sys2"
```

---

# PART 1B: Indentation Rules (Python-Style Scoping)

## 1B.1 Core Principle

CNL uses **Python-style indentation** to determine scope and grouping. There are NO curly braces `{}` or `begin/end` keywords in CNL - indentation IS the structure.

## 1B.2 Indentation Rules

| Rule | Description |
|------|-------------|
| **4 spaces** | Standard indent unit (tabs converted to 4 spaces) |
| **Colon starts block** | Lines ending with `:` open a new indented block |
| **Same indent = same scope** | Statements at same indentation level belong together |
| **Dedent closes block** | Returning to previous indent level closes the block |

## 1B.3 Examples

### Single-level block
```cnl
For any Person x:
    x has Fever.          // Inside the ForAll block
    x is sick.            // Also inside (same indent)
x is healthy.             // OUTSIDE - dedented, new statement
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @c1 HasFever $x
    @c2 IsSick $x
    @and And $c1 $c2
    return $and
end
@f1 IsHealthy x           # Separate statement
```

### Nested blocks
```cnl
For any Person x:
    For any Person y:
        If Trusts(x, y) then Knows(y, x).   // Nested 2 levels
    x exists.                                // Back to level 1
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @inner1 ForAll Person graph y
        @c1 Trusts $x $y
        @c2 Knows $y $x
        @imp Implies $c1 $c2
        return $imp
    end
    @c3 Exists $x
    return $c3
end
```

### Definition blocks
```cnl
Definition: Producer <Cell c> is:
    For all Protein p:
        If Expresses(c, p) then Active(p).
```
The indentation shows:
- `For all Protein p:` is INSIDE the Definition
- `If Expresses...` is INSIDE the ForAll

## 1B.4 Common Mistakes

```cnl
// WRONG - body not indented
For any Person x:
x has Fever.              // ERROR: should be indented

// WRONG - inconsistent indentation  
For any Person x:
    x has Fever.
  x is sick.              // ERROR: 2 spaces, should be 4

// CORRECT
For any Person x:
    x has Fever.
    x is sick.
```

## 1B.5 Inline vs Block Style

Short rules can be written inline (no block needed):
```cnl
// Inline (single statement, no colon needed for body)
If HasFlu(x) then HasFever(x).

// Block style (multiple statements need indentation)
For any Person x:
    If HasFlu(x) then HasFever(x).
    If HasFlu(x) then Coughs(x).
```

---

# PART 1C: Natural Predicate Patterns (IMPLEMENTED)

The CNL translator automatically converts natural English patterns to DSL predicates.
**NO PARENTHESES NEEDED** for most patterns!

## 1C.1 Supported Patterns

| CNL Pattern | Example | DSL Output |
|-------------|---------|------------|
| `X has Y` | `p1 has Fever` | `HasFever p1` |
| `X is Y` | `Socrates is Mortal` | `Mortal Socrates` |
| `X verb Y` | `Alice trusts Bob` | `Trusts Alice Bob` |
| `X is Y of Z` | `p1 is Parent of p2` | `Parent p1 p2` |
| `X coughs` | `p1 coughs` | `Coughs p1` |
| `X expresses Y` | `c0 expresses p1` | `Expresses c0 p1` |

## 1C.2 When to Use Explicit Pred(args) Syntax

Use `Pred(arg1, arg2)` only when:
1. **Nested functions**: `Succ(n)`, `Next(Yellow(x))`
2. **Multi-arg predicates with values**: `Age(p1, 16)`, `Prob(X, 0.8)`
3. **Complex terms**: `Distance(A, B, 100)`

## 1C.3 Examples - Natural vs Explicit

```cnl
// NATURAL (preferred) - no parentheses
p1 has Fever.
Alice trusts Bob.
Socrates is Man.
If p has Flu then p has Fever.

// EXPLICIT (only when needed)
Succ(n) is Nat.           // Nested function
Age(p1, 16).               // Predicate with value
Prob(Cloudy(today), 0.8).  // Complex annotation
```

## 1C.4 Translation Examples

**Medical diagnosis:**
```cnl
// Input (natural CNL)
For any Patient p:
    If p has Flu then p has Fever.
    If p has Cold then p coughs.
p1 has Fever.
```
```sys2
# Output (DSL)
@rule1 ForAll Patient graph p
    @c1 HasFlu $p
    @c2 HasFever $p
    @imp1 Implies $c1 $c2
    return $imp1
end
@rule2 ForAll Patient graph p
    @c3 HasCold $p
    @c4 Coughs $p
    @imp2 Implies $c3 $c4
    return $imp2
end
@f1 HasFever p1
```

**Social network:**
```cnl
// Input
Alice trusts Bob.
Bob trusts Charlie.
For any User x, y, z:
    If x trusts y and y trusts z then x trusts z.
```
```sys2
# Output
@f1 Trusts Alice Bob
@f2 Trusts Bob Charlie
@rule1 ForAll User graph x
    @inner1 ForAll User graph y
        @inner2 ForAll User graph z
            @c1 Trusts $x $y
            @c2 Trusts $y $z
            @and1 And $c1 $c2
            @c3 Trusts $x $z
            @imp Implies $and1 $c3
            return $imp
        end
        return $inner2
    end
    return $inner1
end
```

---

# PART 2: Theory Files (Authoritative)

## 2.1 PREFERRED: CNL Theory Files

Domain knowledge should be expressed in `.cnl` files:

```cnl
// theories/domains/medical.cnl
Patient is a Domain.
Symptom is a Domain.

Flu is a Disease.
Cold is a Disease.

For any Patient p:
    If p has Flu then p has Fever.
    If p has Cold then p coughs.
```

**Location**: `/theories/domains/` for reusable theories.

## 2.2 Sys2 Schema Files (Authoritative Vocabulary)

Vocabulary is derived from Sys2 schema files (`.sys2`) using declarations and typing statements.

```sys2
@Person:Person __Atom
@Cell:Cell __Atom
@Alice:Alice __Atom
@Bob:Bob __Atom
@c0:c0 __Atom
IsA Alice Person
IsA Bob Person
IsA c0 Cell
```

## 2.3 Theory File Structure

```
theories/
├── core/           # Core logic (built-in)
├── domains/        # Reusable domain theories
│   ├── medical.cnl
│   ├── family.cnl
│   ├── social.cnl
│   └── biology.cnl
└── README.md
```

---

# PART 3: Natural Sentence Patterns

## 3.1 Declarations

### Single Constant
```cnl
Alice is a Person.
Let Alice be a Person.
c0 is a Cell.
```
-> DSL:
```sys2
@Alice:Alice __Atom
IsA Alice Person
```

### Multiple Constants
```cnl
Let Alice, Bob, Charlie be Persons.
Alice, Bob, Charlie are Persons.
```
-> DSL:
```sys2
@Alice:Alice __Atom
@Bob:Bob __Atom
@Charlie:Charlie __Atom
IsA Alice Person
IsA Bob Person
IsA Charlie Person
```

### Domain Declaration
```cnl
Let Person be a Domain.
Person is a Domain.
```
-> DSL:
```sys2
@Person:Person __Atom
```

## 3.2 Simple Facts (Subject-Verb-Object)

### Intransitive (1-arg predicates)
```cnl
Alice has Fever.
Bob coughs.
```
-> DSL:
```sys2
@f1 HasFever Alice
@f2 Coughs Bob
```

### Transitive (2-arg predicates)
```cnl
Alice trusts Bob.
c0 expresses p1.
```
-> DSL:
```sys2
@f1 Trusts Alice Bob
@f2 Expresses c0 p1
```

### With Preposition
```cnl
p1 is Parent of p2.
Alice is Ancestor of Charlie.
```
-> DSL:
```sys2
@f1 Parent p1 p2
@f2 Ancestor Alice Charlie
```

### Adjective Predicate
```cnl
Alice is sick.
p1 is active.
```
-> DSL:
```sys2
@f1 IsSick Alice
@f2 Active p1
```

## 3.3 Explicit Predicate Syntax (Fallback)

When natural patterns don't fit, use explicit function-style:
```cnl
HasFever(Alice).
Trusts(Alice, Bob).
Expresses(c0, p1).
```
-> DSL:
```sys2
@f1 HasFever Alice
@f2 Trusts Alice Bob
@f3 Expresses c0 p1
```

---

# PART 4: Natural Rules (Single Variable)

## 4.1 "Every X with Y has Z" Pattern

For simple rules with one implied variable:
```cnl
Every Person with Flu has Fever.
Every Cell that expresses a Protein activates that Protein.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @c1 HasFlu $x
    @c2 HasFever $x
    @imp1 Implies $c1 $c2
    return $imp1
end

@rule2 ForAll Cell graph c
    @inner ForAll Protein graph p
        @c1 Expresses $c $p
        @c2 Activates $c $p
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner
end
```

## 4.2 "Anyone who X is Y" Pattern

```cnl
Anyone who has Flu is sick.
Anyone who trusts someone is trusted back.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @c1 HasFlu $x
    @c2 IsSick $x
    @imp Implies $c1 $c2
    return $imp
end
```

## 4.3 "Given ... Then ..." Pattern

```cnl
Given a Person has Flu,
then that Person has Fever.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @c1 HasFlu $x
    @c2 HasFever $x
    @imp Implies $c1 $c2
    return $imp
end
```

---

# PART 5: Semi-Formal Rules (Named Variables)

## 5.1 "For any X x, y:" Pattern

When you need to name variables:
```cnl
For any Person x, y:
    If x trusts y then y knows x.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @inner1 ForAll Person graph y
        @c1 Trusts $x $y
        @c2 Knows $y $x
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner1
end
```

Note: `For any Person x, y:` is shorthand for `For all Person x, Person y:`.

## 5.2 Three-Variable Rules

For transitivity and similar patterns:
```cnl
For any Person x, y, z:
    If x trusts y and y trusts z then x trusts z.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @inner1 ForAll Person graph y
        @inner2 ForAll Person graph z
            @c1 Trusts $x $y
            @c2 Trusts $y $z
            @and1 And $c1 $c2
            @c3 Trusts $x $z
            @imp Implies $and1 $c3
            return $imp
        end
        return $inner2
    end
    return $inner1
end
```

## 5.3 Quantifier Synonyms

All these are equivalent:
```cnl
For any Person x:        // Preferred for rules
For all Person x:        // Explicit
For every Person x:      // Natural
Each Person x:           // Compact
Every Person x:          // Natural (with colon)
```

---

# PART 6: Explicit Quantifier Syntax

## 6.1 Full Type Specification

When mixing types:
```cnl
For all Person x, Cell c, Protein p:
    If c expresses p then p affects x.
```

## 6.2 Nested Quantifiers

```cnl
For all Person x:
    For all Person y:
        If x trusts y then y trusts x.
```

## 6.3 Existential Quantifier

### Assertion
```cnl
There exists Person p:
    p has Fever.
    
Some Person has Fever.
```

### Query (with `?`)
```cnl
Which Person p has Fever?
Find a Person p such that p is sick?
```

---

# PART 7: Definitions

## 7.1 Natural Definition

```cnl
Define Producer as a Cell c where:
    Every Protein expressed by c is active.
```
-> DSL:
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

## 7.2 Explicit Definition

```cnl
Definition: Producer <Cell c> is:
    For all Protein p:
        If Expresses(c, p) then Active(p).
```
Same DSL output.

## 7.3 Definition with Parameters

```cnl
Define Ancestor(Person x, Person y) as:
    x is Parent of y
    or (there exists Person z: x is Parent of z and z is Ancestor of y).
```

---

# PART 8: Named Blocks (Rules, Theorems, Axioms)

Named blocks are stored as **KB names** so they can be referenced in proofs and explanations.
Use unlabeled forms when you do not want a persistent name.

## 8.1 Named Rules

```cnl
Rule TransitiveTrust:
    For any Person x, y, z:
        If x trusts y and y trusts z then x trusts z.
```
-> DSL:
```sys2
@TransitiveTrust:TransitiveTrust ForAll Person graph x
    @inner1 ForAll Person graph y
        @inner2 ForAll Person graph z
            @c1 Trusts $x $y
            @c2 Trusts $y $z
            @and And $c1 $c2
            @c3 Trusts $x $z
            @imp Implies $and $c3
            return $imp
        end
        return $inner2
    end
    return $inner1
end
```

## 8.2 Theorems (with Given/Conclude)

```cnl
Theorem SocratesIsMortal:
    Given:
        Socrates is a Man.
        Every Man is Mortal.
    Conclude:
        Socrates is Mortal.
```

## 8.3 Axioms

```cnl
Axiom SymmetricTrust:
    For any Person x, y:
        x trusts y if and only if y trusts x.
```

---

# PART 9: Logical Connectives

## 9.1 Conjunction

```cnl
Alice has Fever and coughs.
Bob trusts Alice and Charlie.
```
-> DSL:
```sys2
@c1 And { HasFever Alice } { Coughs Alice }
@c2 And { Trusts Bob Alice } { Trusts Bob Charlie }
```

## 9.2 Disjunction

```cnl
Alice has Fever or has Cold.
```
-> DSL:
```sys2
@c1 Or { HasFever Alice } { HasCold Alice }
```

## 9.3 Negation

```cnl
Alice does not have Fever.
Bob is not sick.
It is not the case that Alice trusts Bob.
```
-> DSL:
```sys2
@n1 Not { HasFever Alice }
@n2 Not { IsSick Bob }
@n3 Not { Trusts Alice Bob }
```

## 9.4 Conditionals

```cnl
If Alice has Flu then Alice has Fever.
```
-> DSL:
```sys2
@imp1 Implies { HasFlu Alice } { HasFever Alice }
```

## 9.5 Operator Precedence

| Operator | Precedence | CNL Forms |
|----------|------------|-----------|
| `not` | 4 (highest) | `not`, `does not`, `is not` |
| `and` | 3 | `and` |
| `or` | 2 | `or` |
| `implies` | 1 (lowest) | `implies`, `if...then` |

---

# PART 10: FORBIDDEN Constructs

| Construct | Example | Why Forbidden |
|-----------|---------|---------------|
| Pronouns | `Alice is sick. She coughs.` | Ambiguous reference |
| Ellipsis | `Alice trusts Bob and Charlie does too.` | Incomplete |
| Passive without agent | `The protein is expressed.` | Missing subject |
| Implicit bare quantification | `Cells express proteins.` | Use `Every Cell...` |

Correct versions:
```cnl
Alice is sick. Alice coughs.
Alice trusts Bob and Charlie trusts Bob.
c0 expresses p1.
Every Cell expresses some Protein.
```

---

# PART 11: Grammar Summary (EBNF)

```ebnf
document     := (block | statement)* ;

statement    := declaration "."
              | fact "."
              | simpleRule "."
              | conditional "."
              | query "?" ;

// Declarations
declaration  := "Let" IDENT "be" "a" TYPE
              | "Let" identList "be" TYPE ("s")?
              | IDENT "is" "a" TYPE
              | "Let" IDENT "be" "a" "Domain" ;

// Natural rules (single variable)
simpleRule   := "Every" TYPE "with" pred "has" pred
              | "Every" TYPE "that" verbPhrase verbPhrase
              | "Anyone" "who" verbPhrase "is" adjective
              | "Given" sentence "," ("then")? sentence ;

// Semi-formal rules (named variables)
quantRule    := quantHead ":" INDENT (statement)+ DEDENT ;
quantHead    := ("For" ("any"|"all"|"every"|"each") | "Each" | "Every")
                binder ("," binder)* ;
binder       := TYPE IDENT ("," IDENT)* ;

// Facts
fact         := subject predPhrase
              | subject "is" adjective
              | explicitPred ;
explicitPred := PREDNAME "(" argList ")" ;

// Conditionals
conditional  := "If" expr "then" expr ;

// Expressions
expr         := orExpr (("implies"|"iff") orExpr)? ;
orExpr       := andExpr ("or" andExpr)* ;
andExpr      := unaryExpr ("and" unaryExpr)* ;
unaryExpr    := ("not"|"does" "not"|"is" "not") unaryExpr | atomExpr ;
```

---

# PART 12: Complete Examples

## Example 1: Medical (Natural Style)

```cnl
Let Patient be a Domain.
Let p1 be a Patient.

// Natural rules
Every Patient with Flu has Fever.
Every Patient with Flu coughs.

// Facts
p1 has Flu.

// Query
Which Patient has Fever?
```

## Example 2: Social Trust (Semi-Formal)

```cnl
Let User be a Domain.
Let Alice, Bob, Charlie be Users.

// Semi-formal (named variables for transitivity)
For any User x, y, z:
    If x trusts y and y trusts z then x trusts z.

// Facts
Alice trusts Bob.
Bob trusts Charlie.
```

## Example 3: Biology (Explicit + Definition)

```cnl
Let Cell be a Domain.
Let Protein be a Domain.
Let c0 be a Cell.
Let p1 be a Protein.

// Definition
Definition: Producer <Cell c> is:
    For all Protein p:
        If Expresses(c, p) then Active(p).

// Facts
Expresses(c0, p1).
Producer(c0).

// Query
Is p1 active?
```

## Example 4: Family (Recursive)

```cnl
Let Person be a Domain.
Let p1, p2, p3 be Persons.

// Facts
Parent(p1, p2).
Parent(p2, p3).

// Recursive definition
Define Ancestor(Person x, Person y) as:
    x is Parent of y
    or (there exists Person z: x is Parent of z and z is Ancestor of y).

// Query
Is p1 Ancestor of p3?
```

---

# References

- DS-006 (typed AST - shared representation)
- DS-008 (DSL syntax)
- DS-016 (error handling)
- DS-018 (CNL <-> DSL translator)
- DS-019 (reserved keywords)
