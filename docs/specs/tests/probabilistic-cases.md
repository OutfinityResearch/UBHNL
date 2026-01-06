# Probabilistic Cases (DS-013)

These are normative example cases for `Frag_WMC` / `Frag_Prob`. They are written as *spec fixtures* and are independent of any particular backend.

## Case P-001: Independent Bernoulli priors (exact WMC)
Given two Boolean variables `x`, `y` with independent priors:
- `P(x)=3/10`, `P(¬x)=7/10`
- `P(y)=1/2`, `P(¬y)=1/2`

Theory: `T = true` (no constraints).

Expected:
- `W(T) = 1` (normalized as a probability model),
- `P(x) = 3/10`,
- `P(y) = 1/2`,
- `P(x ∧ y) = 3/20`.

## Case P-002: Evidence and conditional probability
Reuse P-001, add evidence `E = (x = true)`.

Expected:
- `P(x | E) = 1`,
- `P(y | E) = 1/2`,
- `P(x ∧ y | E) = 1/2`.

## Case P-003: Deterministic decimal parsing
Exact mode must parse decimals deterministically as rationals:
- `0.125` must be interpreted as `125/1000`.

Expected:
- the exact-mode result must be reproducible across runs and machines,
- no floating-point rounding is permitted in the trusted path.

## Case P-004: Exact-vs-approx policy
If `requireExact=true` and no checkable exact route is available:
- the final status must be `UNKNOWN`.

If `allowApprox=true`:
- the result may include an `estimate` plus audit metadata (seeds, confidence parameters).

