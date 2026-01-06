# DS-017: Universal CNL (Strict Technical Specification)

## Goal
Define a rigorous, "Universal" Controlled Natural Language (U-CNL) that maps deterministically to the UBH DAG-based DSL. It must support classical FOL, Modal Logics, and Domain-Specific extensions.

## Core Syntax Principles
1.  **Strict Indentation**: Used for scope (blocks).
2.  **Keywords**: Capitalized (e.g., `For all`, `If`, `Then`).
3.  **Variables**: Explicitly named or bound.

## 1. Classical Logic
### Quantifiers
```text
For all <Type> <var>, <Condition>:
    <Consequence>
```
Maps to: `forall $var Type $Condition`

### Connectives
- `If <A> then <B>` -> `implies $A $B`
- `<A> and <B>` -> `and $A $B`
- `<A> or <B>` -> `or $A $B`
- `It is not the case that <A>` -> `not $A`

## 2. Modal & Advanced Logics
Universal CNL supports modal operators via standard prefixes.

### Alethic Logic (Necessity/Possibility)
- `It is necessary that <P>` -> `box $P`
- `It is possible that <P>` -> `diamond $P`

### Temporal Logic (LTL)
- `Always <P>` -> `always $P` (Global G)
- `Eventually <P>` -> `eventually $P` (Future F)
- `Next <P>` -> `next $P` (X)
- `<A> until <B>` -> `until $A $B`

### Epistemic Logic (Knowledge/Belief)
- `<Agent> knows that <P>` -> `knows $Agent $P`
- `<Agent> believes that <P>` -> `believes $Agent $P`

## 3. Definition Blocks (Macros)
```text
Definition: Prime <Integer x> is:
    Range: x > 1
    Condition: For all Integer div:
        If divides(div, x) then (div == 1 or div == x)
```
Maps to DSL definition:
```dsl
@Prime lambda $x begin
    @c1 gt $x 1
    @cond lambda $div begin
       @divides divides $div $x
       @is1 eq $div 1
       @isx eq $div $x
       @or_res or $is1 $isx
       implies $divides $or_res
    end
    @forall_div forall $div Integer $cond
    and $c1 $forall_div
end
```

## 4. Constraint Blocks
```text
Constraint <Name>:
    Variables:
        Cell c
        Protein p
    Body:
        If Expresses(c, p) then Active(p)
```
Maps to DSL assertion:
```dsl
@body lambda $p begin
    @expr Expresses $c $p
    @act Active $p
    implies $expr $act
end
@inner forall $p Protein $body
@outer lambda $c begin
    # ... nesting context ...
    # Note: simplified for example
end
```
*(Note: Real implementation handles multi-variable constraints via nested lambdas or tuple unpacking)*

## 5. Examples

### Modal Example
```text
It is necessary that:
    For all Person p:
        If p is Alive then Eventually p is Dead
```

DSL (Flattened DAG):
```dsl
# Lambda for the condition
@cond lambda $p begin
    @p_alive Alive $p
    @p_dead Dead $p
    @fut_dead eventually $p_dead
    implies $p_alive $fut_dead
end

# Quantifier binds to lambda
@quant forall $p Person $cond
@root box $quant
# Assert the root
$root
```


### Epistemic Example
```text
Alice knows that:
    Bob believes that it is raining
```

DSL (Flattened DAG):
```dsl
@fact Raining
@bel believes Bob $fact
@know knows Alice $bel
$know
```



