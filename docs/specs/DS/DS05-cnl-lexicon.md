# DS-005: Controlled Natural Language (CNL) and Lexicon

## Goal

Define a **Controlled Natural Language (CNL)** that:
- Looks and feels like natural English
- Maps **deterministically** to the DSL (DS-008); DSL is a superset
- Supports multiple styles: fully natural, semi-formal, and explicit
- Is suitable for non-programmers and domain experts
- Is **not** the source of truth for schemas/metadata (use Sys2 for that)

---

# PART 1: Design Principles

## 1.1 Non-Negotiable Rules

1. **Deterministic parse**: Same input always produces same AST
2. **CNL-core round-trip**: Every CNL-core construct maps to exactly one DSL construct; DSL may express more than CNL
3. **Typed**: Every predicate argument has a declared type
4. **No pronouns**: Anaphoric references (`he`, `she`, `it`, `they`) are FORBIDDEN
5. **No ellipsis**: Incomplete sentences are FORBIDDEN
6. **Finite domains**: Quantifiers range over declared finite domains
7. **Explicit variables**: Variable references use `$` to disambiguate from constants
8. **Implicit quantification for `$`**: A `$x` used outside any quantifier is treated as `ForAll Entity graph x` for that statement

## 1.2 Three Styles of CNL

The CNL supports three levels of naturality:

| Style | When to Use | Example |
|-------|-------------|---------|
| **Natural** | Simple single-variable rules | `Every Person with Flu has Fever.` |
| **Semi-formal** | Rules where variables need names | `For any Person $x, $y: If $x trusts $y then $y knows $x.` |
| **Explicit** | Complex multi-variable rules | `For all Person $x, Person $y, Person $z:` |

All three styles translate to the same DSL format.

## 1.3 CNL vs DSL Comparison

| Aspect | CNL (`.cnl`) | DSL (`.sys2`) |
|--------|--------------|---------------|
| **Purpose** | Human authoring | Machine storage |
| **Schema/metadata** | Not authoritative | Canonical |
| **Style** | Natural English | Symbolic |
| **Variables** | Prefixed: `$x`, `$person1` | Prefixed: `$x`, `$person1` |
| **Quantifiers** | `Every`, `For any`, `For all` | `ForAll ... graph ... end` |
| **Statements** | End with `.` | End with newline |
| **Comments** | `//` or `#` | `#` or `//` |
| **Grouping** | Parentheses `()` allowed | Braces `{ }` only |

Note: CNL is a strict, human-friendly subset. DSL may contain constructs with no CNL equivalent; round-trip is guaranteed only for the CNL-core subset.

---

# PART 1A: Theory Loading

## 1A.1 The `load` Directive

CNL files can load other theory files using the `load` directive:

```cnl
load "theories/domains/medical.sys2"
load "theories/core/logic.sys2"
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

load "../theories/domains/medical.sys2"  // OK - relative to current file
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
load "theories/domains/medical.sys2"

// Now we can use Patient, Disease, Symptom from medical.sys2
Let p1 be a Patient.
p1 has Flu.
// Rule from medical.sys2 applies: If $p has Flu then $p has Fever.
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
For any Person $x:
    $x has Fever.          // Inside the ForAll block
    $x is sick.            // Also inside (same indent)
Alice is healthy.         // OUTSIDE - dedented, new statement
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @c1 HasFever $x
    @c2 IsSick $x
    @and And $c1 $c2
    return $and
end
@f1 IsHealthy Alice       # Separate statement
```

### Nested blocks
```cnl
For any Person $x:
    For any Person $y:
        If Trusts($x, $y) then Knows($y, $x).   // Nested 2 levels
    $x exists.                                // Back to level 1
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
Definition: Producer <Cell $c> is:
    For all Protein $p:
        If Expresses($c, $p) then Active($p).
```
The indentation shows:
- `For all Protein $p:` is INSIDE the Definition
- `If Expresses...` is INSIDE the ForAll

## 1B.4 Common Mistakes

```cnl
// WRONG - body not indented
For any Person $x:
$x has Fever.              // ERROR: should be indented

// WRONG - inconsistent indentation  
For any Person $x:
    $x has Fever.
  $x is sick.              // ERROR: 2 spaces, should be 4

// CORRECT
For any Person $x:
    $x has Fever.
    $x is sick.
```

## 1B.5 Inline vs Block Style

Short rules can be written inline (no block needed):
```cnl
// Inline (single statement, no colon needed for body)
If Alice has Flu then Alice has Fever.

// Block style (multiple statements need indentation)
For any Person $x:
    If HasFlu($x) then HasFever($x).
    If HasFlu($x) then Coughs($x).
```

**Block semantics**: when a block contains multiple statements, they are combined with an implicit `and`.

---

# PART 1C: Natural Predicate Patterns (IMPLEMENTED)

The CNL translator automatically converts natural English patterns to DSL predicates.
**NO PARENTHESES NEEDED** for most patterns!

## 1C.1 Supported Patterns

| CNL Pattern | Example | DSL Output |
|-------------|---------|------------|
| `X has Y` | `p1 has Fever` | `HasFever p1` (if declared) or `Has p1 Fever` (fallback) |
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
If Alice has Flu then Alice has Fever.

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
    If $p has Flu then $p has Fever.
    If $p has Cold then $p coughs.
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

## 1C.5 Variable References

Variable references are **explicit** and use a `$` prefix in CNL:

```cnl
For any Person $x:
    If $x has Flu then $x has Fever.
```

Bare identifiers always refer to vocabulary/KB constants.
Binders must use `$` prefix (e.g., `For any Person $x:`), and any **use** of the variable in a statement must also be `$x`.
If a `$`-prefixed variable appears outside any quantifier, it is **implicitly universally quantified**
over the default domain `Entity` for that statement.

Example (implicit quantifier):
```cnl
If $x is Man then $x is Mortal.
```
-> DSL:
```sys2
@Entity:Entity __Atom
@rule1 ForAll Entity graph x
    @c1 Man $x
    @c2 Mortal $x
    @imp Implies $c1 $c2
    return $imp
end
```
Front-ends introduce `Entity` if missing and add `IsA <const> Entity` for declared constants.
`Entity` is treated as a top domain for implicit quantification and should not be repurposed for a narrower meaning.

## 1C.6 Surface Normalization and Alias Mapping

Natural surface phrases map to predicate symbols deterministically:
1) If the vocabulary defines an explicit alias for the phrase, use that alias.
2) Otherwise, normalize by:
   - splitting on spaces and hyphens,
   - lowercasing the first token,
   - capitalizing the first letter of subsequent tokens,
   - concatenating the result (camelCase).

Examples:
- `gene A` → `geneA`
- `protein P` → `proteinP`
- `has fever` → `hasFever`

If the normalized name is not in the vocabulary, the input is rejected (see DS-016).

## 1C.7 Disambiguation and "has" Resolution

CNL uses parentheses to remove ambiguity in natural text:

### Multi-word properties (use parentheses)
```cnl
Alice has (High Fever).
Alice has (Blood Type A).
```

### Compound subjects (use parentheses)
```cnl
(Alice and Bob) trust Charlie.
(The patient) has Fever.
```

### Nested predicates
```cnl
If Alice has (Chronic Flu) then Alice has (High Fever).
```

### "has" resolution (hybrid rule)
For `X has Y`:
1. If the vocabulary defines a unary predicate `HasY`, use `HasY X`.
2. Else if the vocabulary defines a binary predicate `Has` and a constant `Y`, use `Has X Y`.
3. Otherwise reject the statement (unknown predicate or property).

Property terms in parentheses are normalized into a single token before lookup (alias or camelCase).

Example (fallback):
```cnl
If $x has (High Fever) then $x is Severe.
```
-> DSL:
```sys2
@rule1 ForAll Entity graph x
    @c1 Has $x HighFever
    @c2 Severe $x
    @imp Implies $c1 $c2
    return $imp
end
```
Front-ends introduce `Entity` if needed and ensure `Has` and `HighFever` are declared in the vocabulary.
Recommended: define a `Property` domain and declare property constants there when using the generic `Has`.

## 1C.8 Adding New Patterns

To add a new CNL pattern:

1. Define the pattern in the translator configuration.
2. Register the predicate in the vocabulary (Sys2 `Vocab`).
3. Document the new pattern in DS-005 for reference.

Example - adding "X suffers from Y":
```javascript
// Translator config (conceptual)
patterns.add({
  cnl: "X suffers from Y",
  dsl: "SuffersFrom $1 $2",
  types: ["Person", "Disease"]
});
```

Then add to the vocabulary:
```sys2
Vocab
    Pred SuffersFrom Person Disease
end
```

**Social network:**
```cnl
// Input
Alice trusts Bob.
Bob trusts Charlie.
For any User x, y, z:
    If $x trusts $y and $y trusts $z then $x trusts $z.
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

## 2.1 PREFERRED: Sys2 Theory Files

Domain knowledge should be stored canonically in `.sys2` files. CNL is suitable for authoring,
but persisted theory files in `/theories/` should be Sys2.

```sys2
# theories/domains/medical.sys2
Vocab
    Domain Patient
    Pred HasFlu Patient
    Pred HasFever Patient
    Pred HasCold Patient
    Pred Coughs Patient
end

@FluCausesFever:FluCausesFever ForAll Patient graph p
    @c1 HasFlu $p
    @c2 HasFever $p
    @imp Implies $c1 $c2
    return $imp
end
Assert FluCausesFever

@FluCausesCough:FluCausesCough ForAll Patient graph p
    @c3 HasFlu $p
    @c4 Coughs $p
    @imp Implies $c3 $c4
    return $imp
end
Assert FluCausesCough

@ColdCausesCough:ColdCausesCough ForAll Patient graph p
    @c5 HasCold $p
    @c6 Coughs $p
    @imp Implies $c5 $c6
    return $imp
end
Assert ColdCausesCough
```

**Location**: `/theories/domains/` for reusable theories.

## 2.2 Sys2 Vocabulary Blocks (Authoritative)

Vocabulary is derived from Sys2 `Vocab` blocks (DS-008). Legacy `@... __Atom` + `IsA` is supported for compatibility.

```sys2
Vocab
    Domain Person
    Domain Cell
    Const Alice Person
    Const Bob Person
    Const c0 Cell
end
```

## 2.3 Theory File Structure

```
theories/
├── core/           # Core logic (built-in)
├── domains/        # Reusable domain theories
│   ├── medical.sys2
│   ├── family.sys2
│   ├── social.sys2
│   └── biology.sys2
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
Vocab
    Domain Person
    Const Alice Person
end
```

### Multiple Constants
```cnl
Let Alice, Bob, Charlie be Persons.
Alice, Bob, Charlie are Persons.
```
-> DSL:
```sys2
Vocab
    Domain Person
    Const Alice Person
    Const Bob Person
    Const Charlie Person
end
```

### Domain Declaration
```cnl
Let Person be a Domain.
Person is a Domain.
```
-> DSL:
```sys2
Vocab
    Domain Person
end
```

### Subtype Declaration
```cnl
Patient is a subtype of Person.
```
-> DSL:
```sys2
SubType Patient Person
```

### Alias Declaration
Use an alias when a local name would otherwise collide with a global KB name.
```cnl
Alias localPatient as Patient.
```
-> DSL:
```sys2
Alias localPatient Patient
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

When natural patterns don't fit, use explicit function-style. Terms may include function applications and numeric literals:
```cnl
HasFever(Alice).
Trusts(Alice, Bob).
Expresses(c0, p1).
Age(p1, 16).
Next(Yellow(p1)).
```

Numeric literals follow the same lexical rules as DSL (integers, rationals `a/b`, or decimals).
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

## 5.1 "For any X $x, $y:" Pattern

When you need to name variables:
```cnl
For any Person $x, $y:
    If $x trusts $y then $y knows $x.
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

Note: `For any Person $x, $y:` is shorthand for `For all Person $x, Person $y:`.

## 5.2 Three-Variable Rules

For transitivity and similar patterns:
```cnl
For any Person $x, $y, $z:
    If $x trusts $y and $y trusts $z then $x trusts $z.
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
For any Person $x:        // Preferred for rules
For all Person $x:        // Explicit
For every Person $x:      // Natural
Each Person $x:           // Compact
Every Person $x:          // Natural (with colon)
```

---

# PART 6: Explicit Quantifier Syntax

## 6.1 Full Type Specification

When mixing types:
```cnl
For all Person $x, Cell $c, Protein $p:
    If $c expresses $p then $p affects $x.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @inner1 ForAll Cell graph c
        @inner2 ForAll Protein graph p
            @c1 Expresses $c $p
            @c2 Affects $p $x
            @imp Implies $c1 $c2
            return $imp
        end
        return $inner2
    end
    return $inner1
end
```

## 6.2 Nested Quantifiers

```cnl
For all Person $x:
    For all Person $y:
        If $x trusts $y then $y trusts $x.
```
-> DSL:
```sys2
@rule1 ForAll Person graph x
    @inner1 ForAll Person graph y
        @c1 Trusts $x $y
        @c2 Trusts $y $x
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner1
end
```

## 6.3 Existential Quantifier

### Assertion
```cnl
There exists Person p:
    $p has Fever.
    
Some Person has Fever.
```
-> DSL:
```sys2
@ex1 Exists Person graph p
    @c1 HasFever $p
    return $c1
end
```

### Query (with `?`)
```cnl
Which Person $p has Fever?
Find a Person $p such that $p is sick?
```
-> DSL:
```sys2
@query1 Exists Person graph p
    @c1 HasFever $p
    return $c1
end
@query2 Exists Person graph p
    @c2 IsSick $p
    return $c2
end
```

---

# PART 7: Definitions

## 7.1 Natural Definition

```cnl
Define Producer as a Cell c where:
    Every Protein expressed by $c is active.
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
        If Expresses($c, $p) then Active($p).
```
Same DSL output.

## 7.3 Definition with Parameters

```cnl
Define Ancestor(Person x, Person y) as:
    $x is Parent of $y
    or (there exists Person z: $x is Parent of $z and $z is Ancestor of $y).
```
-> DSL:
```sys2
@Ancestor:Ancestor graph x y
    @c1 Parent $x $y
    @inner Exists Person graph z
        @c2 Parent $x $z
        @c3 Ancestor $z $y
        @and1 And $c2 $c3
        return $and1
    end
    @or1 Or $c1 $inner
    return $or1
end
```

---

# PART 8: Proof Blocks

CNL supports proof blocks for documenting reasoning steps.

**See DS-020 for the complete proof format specification.**

Quick example:
```cnl
Proof SocratesIsMortal:
    Given:
        Socrates is a Man.
        Every Man is Mortal.
    Therefore:
        Socrates is Mortal.
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

Note: Implicit quantification via **explicit `$` variables** is allowed; this restriction
applies only to bare plural sentences without a quantifier.

Correct versions:
```cnl
Alice is sick. Alice coughs.
Alice trusts Bob and Charlie trusts Bob.
c0 expresses p1.
Every Cell expresses some Protein.
```

## Minimal Anaphora (Allowed)

To keep determinism while supporting common phrasing, a limited rule is allowed:
- `that <Noun>` binds to the **nearest quantified noun phrase in the same sentence**.
- This rule applies only within a single sentence and does not cross sentence boundaries.

Example:
```cnl
Every Cell that expresses a Protein activates that Protein.
```
Here, `that Protein` binds to the closest quantified `Protein` in the same sentence.

---

# PART 11: Grammar Summary (EBNF)

This section is a **summary**. The complete grammar is defined in **DS-022**.

```ebnf
document     := (block | statement)* ;

statement    := declaration "."
              | aliasDecl "."
              | subtypeDecl "."
              | fact "."
              | simpleRule "."
              | conditional "."
              | query "?"
              | proofBlock
              | namedBlock ;

namedBlock   := ruleBlock | axiomBlock | theoremBlock | definitionBlock ;
ruleBlock    := "Rule" IDENT ":" INDENT statement+ DEDENT ;
axiomBlock   := "Axiom" IDENT ":" INDENT statement+ DEDENT ;
theoremBlock := "Theorem" IDENT ":" INDENT theoremSections DEDENT ;
theoremSections := "Given:" INDENT statement+ DEDENT "Conclude:" INDENT statement+ DEDENT ;
definitionBlock := "Definition" IDENT "(" paramList ")" ":" INDENT statement+ DEDENT ;

// Declarations
declaration  := "Let" IDENT "be" "a" TYPE
              | "Let" identList "be" TYPE ("s")?
              | IDENT "is" "a" TYPE
              | "Let" IDENT "be" "a" "Domain" ;

aliasDecl    := "Alias" IDENT "as" IDENT ;
subtypeDecl  := IDENT "is" "a" "subtype" "of" IDENT ;

// Natural rules (single variable)
simpleRule   := "Every" TYPE "with" pred "has" pred
              | "Every" TYPE "that" verbPhrase verbPhrase
              | "Anyone" "who" verbPhrase "is" adjective
              | "Given" sentence "," ("then")? sentence ;

// Semi-formal rules (named variables)
quantRule    := quantHead ":" INDENT (statement)+ DEDENT ;
quantHead    := ("For" ("any"|"all"|"every"|"each") | "Each" | "Every")
                binder ("," binder)* ;
binder       := TYPE (VAR | IDENT) ("," (VAR | IDENT))* ;
paramList    := TYPE (VAR | IDENT) ("," TYPE (VAR | IDENT))* ;

// Facts
fact         := subject predPhrase
              | subject "is" adjective
              | explicitPred ;
explicitPred := PREDNAME "(" termList ")" ;

// Conditionals
conditional  := "If" expr "then" expr ;

// Expressions
expr         := orExpr (("implies"|"iff") orExpr)? ;
orExpr       := andExpr ("or" andExpr)* ;
andExpr      := unaryExpr ("and" unaryExpr)* ;
unaryExpr    := ("not"|"does" "not"|"is" "not") unaryExpr | atomExpr ;

// Terms
term         := VAR
              | IDENT
              | NUMBER
              | funcTerm
              | "(" expr ")" ;
funcTerm     := IDENT "(" termList ")" ;
termList     := term ("," term)* ;

VAR          := "$" IDENT ;

// Phrase primitives (lexicon-driven; must match a registered pattern)
verbPhrase   := predPhrase ;
predPhrase   := IDENT (IDENT)* ;
adjective    := IDENT ;

// Proof blocks (see DS-020)
proofBlock   := "Proof" IDENT ":" INDENT proofSection+ DEDENT ;
proofSection := ("Given"|"Assume"|"Apply"|"Derive"|"Observed"|"Hypothesis"|
                 "Verify"|"Constraint"|"Contradiction"|"Query"|"Found"|"Therefore")
                 ":" INDENT (sentence)+ DEDENT ;
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
Which Patient $p has Fever?
```

## Example 2: Social Trust (Semi-Formal)

```cnl
Let User be a Domain.
Let Alice, Bob, Charlie be Users.

// Semi-formal (named variables for transitivity)
For any User x, y, z:
    If $x trusts $y and $y trusts $z then $x trusts $z.

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
        If Expresses($c, $p) then Active($p).

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
    $x is Parent of $y
    or (there exists Person z: $x is Parent of $z and $z is Ancestor of $y).

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
