# DS-020: Proof Format Specification

## Goal

Define the format for **proof traces** in CNL that:
- Document the reasoning steps taken by the solver
- Are human-readable and verifiable
- Follow a consistent structure across different proof types
- Can be generated automatically by the reasoning engine

---

# PART 1: Proof Types

## 1.1 Deduction Proof

Used when deriving a conclusion from axioms and rules.

**Structure:**
```cnl
Proof DeductionProof:
    Given:
        <list of known facts>
    Apply:
        <rule name or statement>
    Derive:
        <intermediate or final conclusion>
    Therefore:
        <final answer>
```

## 1.2 Contradiction Proof (Reductio ad Absurdum)

Used when proving unsatisfiability or detecting conflicts.

**Structure:**
```cnl
Proof ContradictionProof:
    Assume:
        <contradictory facts>
    Constraint:
        <rule that is violated>
    Contradiction:
        <explanation of conflict>
    Therefore:
        UNSAT
```

## 1.3 Abduction Proof

Used when finding explanations for observations.

**Structure:**
```cnl
Proof AbductionProof:
    Observed:
        <observed facts>
    Hypothesis:
        <proposed explanation>
    Verify:
        <check consistency with rules>
    Therefore:
        <hypothesis is valid/invalid>
```

## 1.4 Witness Proof

Used when finding a satisfying assignment (existential).

**Structure:**
```cnl
Proof WitnessProof:
    Query:
        <what we're looking for>
    Found:
        <witness value>
    Verify:
        <proof that witness satisfies query>
    Therefore:
        <witness>
```

---

# PART 2: Proof Syntax

## 2.1 Keywords

| Keyword | Purpose |
|---------|---------|
| `Proof` | Starts a named proof block |
| `Given:` | Lists premises/facts |
| `Assume:` | States assumptions (for contradiction) |
| `Apply:` | Names the rule being applied |
| `Derive:` | Shows intermediate conclusions |
| `Observed:` | Lists observations (for abduction) |
| `Hypothesis:` | States proposed explanation |
| `Verify:` | Shows verification steps |
| `Constraint:` | States violated constraint |
| `Contradiction:` | Explains the conflict |
| `Query:` | States the question |
| `Found:` | States the witness |
| `Therefore:` | Final conclusion |

## 2.2 Statement Format

Within proof blocks, use CNL statement syntax:
- Facts: `Subject predicate [object].`
- Rules: `Rule: <description>.`
- Conclusions: Standard CNL sentences ending with `.`

Non-formal narrative lines are allowed only inside `Apply:` and are treated as notes.
When translated to DSL, these lines become `Note "..."` entries in a proof block.

## 2.3 Step Numbering (Optional)

For complex proofs, steps can be numbered:
```cnl
Proof NumberedProof:
    Given:
        1. a is true.
        2. If a then b.
    Apply:
        3. Modus Ponens on 1, 2.
    Derive:
        4. b is true.
    Therefore:
        b is true.
```

---

# PART 3: Examples

## Example 1: Boolean Deduction (01_deduction_bool_basic)

```cnl
Proof ChainedImplication:
    Given:
        a is true.
        If a then b.
        If b then c.
    Apply:
        Modus Ponens on a and (If a then b).
    Derive:
        b is true.
    Apply:
        Modus Ponens on b and (If b then c).
    Derive:
        c is true.
    Therefore:
        c is true.
```

## Example 2: Family Relations (02_deduction_family_recursive)

```cnl
Proof AncestorTransitivity:
    Given:
        p1 is Parent of p2.
        p2 is Parent of p3.
        For all Person x, y: If $x is Parent of $y then $x is Ancestor of $y.
        For all Person x, y, z: If $x is Parent of $y and $y is Ancestor of $z then $x is Ancestor of $z.
    Apply:
        Rule 2 on p1, p2.
    Derive:
        p1 is Ancestor of p2.
    Apply:
        Rule 2 on p2, p3.
    Derive:
        p2 is Ancestor of p3.
    Apply:
        Rule 1 on p1, p2, p3.
    Derive:
        p1 is Ancestor of p3.
    Therefore:
        p1 is Ancestor of p3.
```

## Example 3: Switch Contradiction (04_sat_conflict_switch)

```cnl
Proof SwitchContradiction:
    Assume:
        switch1 is On.
        switch1 is Off.
    Constraint:
        For all Switch s: It is not the case that ($s is On and $s is Off).
    Contradiction:
        switch1 violates the exclusion constraint.
    Therefore:
        UNSAT
```

## Example 4: Syllogism (05_deduction_syllogism)

```cnl
Proof SocratesMortality:
    Given:
        Socrates is a Man.
        For all Entity x: If $x is Man then $x is Mortal.
    Apply:
        Universal Instantiation with x = Socrates.
    Derive:
        If Socrates is Man then Socrates is Mortal.
    Apply:
        Modus Ponens.
    Therefore:
        Socrates is Mortal.
```

## Example 5: Medical Diagnosis (07_abduction_diagnosis)

```cnl
Proof DiagnosePatient:
    Observed:
        p1 has Fever.
        p1 coughs.
    Hypothesis:
        p1 has Flu.
    Verify:
        If p1 has Flu then p1 has Fever. (consistent)
        If p1 has Flu then p1 coughs. (consistent)
    Therefore:
        Hypothesis "p1 has Flu" is consistent with observations.
```

## Example 6: Social Trust (11_social_trust)

```cnl
Proof TransitiveTrust:
    Given:
        Alice trusts Bob.
        Bob trusts Charlie.
        For all User x, y, z: If $x trusts $y and $y trusts $z then $x trusts $z.
    Apply:
        Transitivity Rule with x=Alice, y=Bob, z=Charlie.
    Derive:
        Alice trusts Bob and Bob trusts Charlie.
    Therefore:
        Alice trusts Charlie.
```

---

# PART 4: Implementation Notes

## 4.1 Proof Generation

The reasoning engine should:
1. Track which rules are applied
2. Record intermediate derivations
3. Format output according to proof type
4. Include step references for verification

## 4.2 Proof Verification

A valid proof must:
1. Start with given facts that exist in KB
2. Apply only valid rules
3. Have correct derivations at each step
4. Reach a valid conclusion

## 4.3 Proof Comparison

For testing, proofs are compared:
- Normalize whitespace
- Compare structure (Given/Apply/Derive/Therefore)
- Allow equivalent formulations

---

# References

- DS-005 (CNL syntax)
- DS-008 (DSL syntax)
- DS-006 (typed AST)
- DS-002 (solver interface)
- DS-010 (fragments and goals)
