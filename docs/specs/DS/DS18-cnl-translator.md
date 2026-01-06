# DS-018: CNL ↔ DSL Translator

## Goal

Specify a **deterministic bidirectional translator** between CNL and DSL:
- **CNL → DSL**: Convert human-readable CNL to machine-friendly DSL for storage
- **DSL → CNL**: Convert DSL back to CNL for display and explanation

The translation is **lossless** and **bijective**: round-tripping preserves semantics exactly.

---

# PART 1: Architecture

```
     CNL Source              DSL Source
         │                       │
         ▼                       ▼
   ┌───────────┐           ┌───────────┐
   │ CNL Parser│           │ DSL Parser│
   │  (DS-005) │           │  (DS-008) │
   └─────┬─────┘           └─────┬─────┘
         │                       │
         ▼                       ▼
       ┌───────────────────────────┐
       │      Typed Logic AST      │
       │         (DS-006)          │
       └─────────────┬─────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   ┌───────────┐           ┌───────────┐
   │CNL Emitter│           │DSL Emitter│
   └─────┬─────┘           └─────┬─────┘
         │                       │
         ▼                       ▼
    CNL Output              DSL Output
```

## Translation Interface

```typescript
interface TranslationResult {
  ok: true;
  output: string;
} | {
  ok: false;
  errors: ErrorReport[];
}

function translateCnlToDsl(cnlSource: string, lexicon: Lexicon): TranslationResult;
function translateDslToCnl(dslSource: string, lexicon: Lexicon): TranslationResult;
function verifyRoundTrip(source: string, format: "cnl" | "dsl", lexicon: Lexicon): boolean;
```

---

# PART 2: Translation Rules

## Rule T01: File Structure

| CNL | DSL |
|-----|-----|
| Statements end with `.` | Statements end with newline |
| Blocks use `:` + indentation | Blocks use `graph ... end` |
| `// comment` | `# comment` |

**Example**:
```cnl
// Biology rules
Let c0 be a Cell.
c0 has gene A.
```
↔
```sys2
# Biology rules
@Cell __Atom
@c0 __Atom
IsA c0 Cell
@f1 GeneA c0
```

## Rule T02: Type/Domain Declaration

| CNL | DSL |
|-----|-----|
| `Let TypeName be a Domain.` | `@TypeName __Atom` |

**Example**:
```cnl
Let Person be a Domain.
Let Cell be a Domain.
```
↔
```sys2
@Person __Atom
@Cell __Atom
```

## Rule T03: Constant Declaration

| CNL | DSL |
|-----|-----|
| `Let name be a Type.` | `@name __Atom` + `IsA name Type` |

**Example**:
```cnl
Let Alice be a Person.
Let c0 be a Cell.
```
↔
```sys2
@Alice __Atom
IsA Alice Person
@c0 __Atom
IsA c0 Cell
```

## Rule T04: Multiple Constant Declaration

| CNL | DSL |
|-----|-----|
| `Let a, b, c be Types.` | Multiple `@x __Atom` + `IsA x Type` |

**Example**:
```cnl
Let Alice, Bob, Charlie be Persons.
```
↔
```sys2
@Alice __Atom
@Bob __Atom
@Charlie __Atom
IsA Alice Person
IsA Bob Person
IsA Charlie Person
```

## Rule T05: Simple Fact (Subject-Verb)

| CNL | DSL |
|-----|-----|
| `Subject has Predicate.` | `@fN Predicate Subject` |
| `Subject verb Object.` | `@fN Verb Subject Object` |

**Example**:
```cnl
Alice has Fever.
Bob trusts Charlie.
p1 is Parent of p2.
```
↔
```sys2
@f1 HasFever Alice
@f2 Trusts Bob Charlie
@f3 Parent p1 p2
```

**Note**: CNL uses Subject-Verb-Object order. DSL uses Predicate-Args order.

## Rule T06: Adjective Facts

| CNL | DSL |
|-----|-----|
| `Subject is adjective.` | `@fN AdjectivePred Subject` |

**Example**:
```cnl
Alice is sick.
p1 is active.
```
↔
```sys2
@f1 IsSick Alice
@f2 Active p1
```

## Rule T07: Negation

| CNL | DSL |
|-----|-----|
| `Subject does not verb.` | `@nN Not { Pred Subject }` |
| `Subject is not adjective.` | `@nN Not { AdjPred Subject }` |

**Example**:
```cnl
Alice does not have Fever.
Bob is not sick.
```
↔
```sys2
@n1 Not { HasFever Alice }
@n2 Not { IsSick Bob }
```

## Rule T08: Conjunction

| CNL | DSL |
|-----|-----|
| `A and B.` | `@cN And { A } { B }` |

**Example**:
```cnl
Alice has Fever and coughs.
```
↔
```sys2
@c1 And { HasFever Alice } { Coughs Alice }
```

## Rule T09: Disjunction

| CNL | DSL |
|-----|-----|
| `A or B.` | `@cN Or { A } { B }` |

**Example**:
```cnl
Alice has Fever or has Cold.
```
↔
```sys2
@c1 Or { HasFever Alice } { HasCold Alice }
```

## Rule T10: Implication (If-Then)

| CNL | DSL |
|-----|-----|
| `If A then B.` | `@impN Implies { A } { B }` |
| `A implies B.` | `@impN Implies { A } { B }` |

**Example**:
```cnl
If Alice has Flu then Alice has Fever.
```
↔
```sys2
@imp1 Implies { HasFlu Alice } { HasFever Alice }
```

## Rule T11: Universal Quantifier

| CNL | DSL |
|-----|-----|
| `For all Type var:` (block) | `@ruleN ForAll Type graph var ... return $expr end` |

**Example**:
```cnl
For all Person p:
    If p has Flu then p has Fever.
```
↔
```sys2
@rule1 ForAll Person graph p
    @c1 HasFlu $p
    @c2 HasFever $p
    @imp Implies $c1 $c2
    return $imp
end
```

## Rule T12: Multiple Quantifier Variables

| CNL | DSL |
|-----|-----|
| `For all Type x, Type y:` (block) | Nested `ForAll` blocks |

**Example**:
```cnl
For all Person x, Person y:
    If x trusts y then y knows x.
```
↔
```sys2
@rule1 ForAll Person graph x
    @inner ForAll Person graph y
        @c1 Trusts $x $y
        @c2 Knows $y $x
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner
end
```

## Rule T13: Existential Quantifier

| CNL | DSL |
|-----|-----|
| `There exists Type var:` (block) | `@exN Exists Type graph var ... return $expr end` |

**Example**:
```cnl
There exists Person p:
    p has Fever.
```
↔
```sys2
@ex1 Exists Person graph p
    @c1 HasFever $p
    return $c1
end
```

## Rule T14: Named Rule Block

| CNL | DSL |
|-----|-----|
| `Rule Name: body` | `@Name:Name ...` |

**Example**:
```cnl
Rule TransitiveTrust:
    For all User x, User y, User z:
        If x trusts y and y trusts z then x trusts z.
```
↔
```sys2
@TransitiveTrust:TransitiveTrust ForAll User graph x
    @inner1 ForAll User graph y
        @inner2 ForAll User graph z
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

## Rule T15: Definition Block

| CNL | DSL |
|-----|-----|
| `Definition Name(params): body` | `@Name:Name graph params ... end` |

**Example**:
```cnl
Definition Producer(Cell c):
    For all Protein p:
        If c expresses p then p is active.
```
↔
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

## Rule T16: Variable References

| CNL | DSL |
|-----|-----|
| Bare `x`, `y`, `p` (in quantifier scope) | Prefixed `$x`, `$y`, `$p` |

**Example**:
```cnl
For all Cell c:
    If geneA(c) then proteinP(c).
```
↔
```sys2
@rule ForAll Cell graph c
    @c1 GeneA $c
    @c2 ProteinP $c
    @imp Implies $c1 $c2
    return $imp
end
```

## Rule T17: Query (Witness Search)

| CNL | DSL |
|-----|-----|
| `Which Type var has pred?` | `@queryN Exists Type graph var ... end` |
| `Find a Type var such that body?` | `@queryN Exists Type graph var ... end` |

**Example**:
```cnl
Which Person p has Fever?
```
↔
```sys2
@query1 Exists Person graph p
    @c1 HasFever $p
    return $c1
end
```

## Rule T18: Alias Expansion

| CNL | DSL |
|-----|-----|
| Multi-word phrase | Single predicate name |

Via lexicon `cnlPatterns`:
```json
{
  "has Fever": "HasFever($1)",
  "is Parent of": "Parent($1, $2)",
  "is Ancestor of": "Ancestor($1, $2)"
}
```

**Example**:
```cnl
Alice has Fever.
p1 is Parent of p2.
```
↔
```sys2
@f1 HasFever Alice
@f2 Parent p1 p2
```

---

# PART 3: Comprehensive Examples

## Example 1: Medical Diagnosis

**CNL** (`diagnosis.cnl`):
```cnl
// Domain declarations
Let Patient be a Domain.
Let p1 be a Patient.

// Diagnostic rules
Rule FluCausesFever:
    For all Patient p:
        If p has Flu then p has Fever.

Rule FluCausesCough:
    For all Patient p:
        If p has Flu then p coughs.

// Observations
p1 has Fever.
p1 coughs.

// Query
Which Patient p has Flu?
```

**DSL** (`diagnosis.sys2`):
```sys2
# Domain declarations
@Patient __Atom
@p1 __Atom
IsA p1 Patient

# Diagnostic rules
@FluCausesFever:FluCausesFever ForAll Patient graph p
    @c1 HasFlu $p
    @c2 HasFever $p
    @imp1 Implies $c1 $c2
    return $imp1
end

@FluCausesCough:FluCausesCough ForAll Patient graph p
    @c3 HasFlu $p
    @c4 Coughs $p
    @imp2 Implies $c3 $c4
    return $imp2
end

# Observations
@f1 HasFever p1
@f2 Coughs p1

# Query
@query1 Exists Patient graph p
    @qc1 HasFlu $p
    return $qc1
end
```

## Example 2: Social Trust

**CNL** (`trust.cnl`):
```cnl
Let User be a Domain.
Let Alice, Bob, Charlie be Users.

Alice trusts Bob.
Bob trusts Charlie.

Rule TransitiveTrust:
    For all User x, User y, User z:
        If x trusts y and y trusts z then x trusts z.
```

**DSL** (`trust.sys2`):
```sys2
@User __Atom
@Alice __Atom
@Bob __Atom
@Charlie __Atom
IsA Alice User
IsA Bob User
IsA Charlie User

@f1 Trusts Alice Bob
@f2 Trusts Bob Charlie

@TransitiveTrust:TransitiveTrust ForAll User graph x
    @inner1 ForAll User graph y
        @inner2 ForAll User graph z
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

## Example 3: Biology Definition

**CNL** (`biology.cnl`):
```cnl
Let Cell be a Domain.
Let Protein be a Domain.
Let c0 be a Cell.

Definition Producer(Cell c):
    For all Protein p:
        If c expresses p then p is active.

c0 is a Producer.
```

**DSL** (`biology.sys2`):
```sys2
@Cell __Atom
@Protein __Atom
@c0 __Atom
IsA c0 Cell

@Producer:Producer graph c
    @inner ForAll Protein graph p
        @c1 Expresses $c $p
        @c2 Active $p
        @imp Implies $c1 $c2
        return $imp
    end
    return $inner
end

@f1 Producer c0
```

---

# PART 4: Canonical Formatting

## DSL Canonical Form
- Keywords: PascalCase (`ForAll`, `Exists`, `Implies`, `And`, `Or`, `Not`)
- One statement per line
- Indentation: 4 spaces inside blocks
- No trailing whitespace
- Single space between tokens
- Braces with spaces: `{ expr }`

## CNL Canonical Form
- Keywords: natural case (`For all`, `There exists`, `If ... then`)
- One statement per line, ending with `.`
- Questions end with `?`
- Indentation: 4 spaces inside blocks
- Natural spacing for readability

---

# PART 5: Error Handling

| Error Code | Condition | Example |
|------------|-----------|---------|
| `E_TRANSLATE_UNKNOWN_ALIAS` | CNL phrase not in lexicon | "has headache" |
| `E_TRANSLATE_SCOPE_ERROR` | Variable used outside scope | `$x` after block ends |
| `E_TRANSLATE_TYPE_MISMATCH` | Argument type mismatch | Person used where Cell expected |
| `E_TRANSLATE_ARITY_MISMATCH` | Wrong argument count | `Trusts Alice` (needs 2 args) |

---

# PART 6: Round-Trip Guarantee

The translator guarantees:
```
parse(emit(parse(source))) ≡ parse(source)
```

Round-tripping produces semantically identical ASTs.

## Testing Strategy

Test fixtures:
- `evals/fastEval/*/source.cnl` - CNL input
- `evals/fastEval/*/expected.sys2` - Expected DSL output

Test runner:
1. Translate CNL → DSL
2. Compare with expected DSL (normalized whitespace)
3. Translate DSL → CNL → DSL
4. Verify round-trip produces identical DSL

---

# References

- DS-005 (CNL grammar and lexicon)
- DS-006 (typed AST - shared representation)
- DS-008 (DSL grammar)
- DS-016 (error handling)
- DS-019 (reserved keywords)
