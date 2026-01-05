# DS-003: Front-end Compilation

## Goal
Define the compilation contract from higher-level logics into UBH.

## Pipeline
1) Parse/construct typed AST in the front-end.
2) Lower types to Bit/BitVector/FiniteDomain.
3) Compile logic operators to XOR/AND/CONST.
4) Emit UBH constraints (assertions).

CNL is treated as a front-end that produces the typed AST via a controlled grammar and lexicon.

## Type Lowering
- Bool -> Bit
- Int[k] -> k Bit wires (two's complement by default)
- Enum[n] -> ceil(log2(n)) bits or one-hot (front-end choice)
- Set(U) -> |U| bits

## Quantifiers
- Finite expansion is allowed for small domains.
- Lazy instantiation is required for large domains (see DS-004).

## Rationale
Compilation keeps the core minimal while enabling many logics.
