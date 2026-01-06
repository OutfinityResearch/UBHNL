# Error Cases (DS-016)

These cases are normative for error codes, blame attribution, and origin reporting.

## Case E-001: DSL “two @ tokens on one line”
Input (DSL):
```sys2
@x P @y
```

Expected:
- error kind: `ParseError` or `VocabError` (implementation choice), but **code must be** `E_DSL_TWO_AT`,
- blame: `UserInput`,
- origin includes correct line/column for the second `@`.

## Case E-002: Unknown bare symbol (strict vocabulary)
Assume the vocabulary does not contain `unknownPredicate`.

Input (DSL):
```sys2
unknownPredicate a0
```

Expected:
- error kind: `VocabError`,
- code: `E_UNKNOWN_SYMBOL`,
- blame: `TheoryFile` (if in a file) or `UserInput` (if entered interactively),
- origin included.

## Case E-003: Hole cannot be typed deterministically
Input (DSL):
```sys2
exists ?x: ?x
```

Expected:
- error kind: `TypeError`,
- code: `E_HOLE_UNTYPED`,
- blame: `UserInput`,
- origin included.

## Case E-004: Certificate digest mismatch
Given a certificate envelope with a mismatched `problemDigest`:

Expected:
- error kind: `CertificateError`,
- code: `E_CERT_DIGEST_MISMATCH`,
- blame: `System` (if generated internally) or `Backend` (if returned by a backend adapter),
- include `problemDigest` in `details`.

