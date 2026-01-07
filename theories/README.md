# UBHNL Theories

This folder contains reusable CNL theory files organized by domain.

## Structure

```
theories/
├── core/           # Core logic primitives
│   └── logic.cnl   # And, Or, Not, Implies, quantifiers
├── domains/        # Domain-specific theories
│   ├── medical.cnl    # Symptoms, diseases, diagnosis rules
│   ├── family.cnl     # Kinship, ancestry relations
│   ├── social.cnl     # Trust, friendship, social networks
│   ├── biology.cnl    # Cells, proteins, genes
│   └── arithmetic.cnl # Natural numbers, Peano axioms
└── README.md
```

## Usage

Theories can be imported/included in test files or session configurations.

### In CNL files:
```cnl
# Import a domain theory
@import theories/domains/medical.cnl

# Then use its predicates and rules
p1 is a Patient.
p1 has Flu.
# -> p1 has Fever (derived from imported rules)
```

### In test suites:
Test-specific theories go in `evals/fastEval/theory/` if they're 
only relevant for testing, not general use.

## Writing Theories

1. **Domain declarations first**: `Person is a Domain.`
2. **Constants if needed**: `Zero is a Nat.`
3. **Rules using natural CNL**: `If x has Flu then x has Fever.`
4. **Comments with #**: `# This is a comment`

## No JSON Schemas!

Previously, domain definitions were in JSON lexicon files.
Now everything is expressed in CNL/DSL for consistency.
The JSON schema in DS-005 is for documentation only.
