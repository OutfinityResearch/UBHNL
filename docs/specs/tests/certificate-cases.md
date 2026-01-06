# Certificate Cases (DS-014)

These cases validate the certificate envelope and checker behavior. They are *spec fixtures*; an implementation may adapt formats, but must preserve semantics.

## Case C-001: DRAT minimal UNSAT proof (CNF contradiction)
CNF:
- Clause 1: `(x)` (DIMACS: `1 0`)
- Clause 2: `(¬x)` (DIMACS: `-1 0`)

Expected:
- The formula is `UNSAT`.
- A DRAT proof that derives the empty clause must be accepted.

Minimal proof sketch (DRAT text):
```
0
```

Note:
- This is a tiny fixture; implementations may use LRAT or a different DRAT encoding, but the checker must accept a valid proof and reject corruption deterministically.

## Case C-002: Digest mismatch
Given a `CertificateEnvelope` with `problemDigest = sha256:A` but the orchestrator checks it against `problemDigest = sha256:B`:

Expected:
- verification fails with `E_CERT_DIGEST_MISMATCH`,
- the final query result is not accepted as `UNSAT/OPTIMAL` (it becomes `UNKNOWN` unless another checkable route confirms it).

## Case C-003: Unsupported certificate format
Given a certificate `kind="ALETHE"` but no Alethe checker is available:

Expected:
- verification fails with `E_CERT_UNSUPPORTED_FORMAT`,
- the final status is `UNKNOWN` for `UNSAT` claims.

## Case C-004: Farkas infeasibility certificate (tiny linear system)
Constraints over reals:
1) `x ≤ 0`
2) `-x ≤ -1` (equivalently `x ≥ 1`)

Choose multipliers:
- `y1 = 1`
- `y2 = 1`

Linear combination:
`(x ≤ 0) + (-x ≤ -1)` ⇒ `0 ≤ -1` (contradiction).

Expected:
- checker validates `y1,y2 ≥ 0`,
- checker validates the derived contradiction,
- claim is accepted as infeasible/UNSAT for the arithmetic core.

