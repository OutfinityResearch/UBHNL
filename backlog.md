# UBHNL Spec Backlog: Contradictions, Ambiguities, and Blocking Gaps

This backlog consolidates issues found across `docs/specs/` and the follow-up report.
Each item lists the problem and possible alternatives. Choose/merge/edit as needed.

## 1) CNL ↔ DSL Isomorphism Is Not Achievable as Stated

**Problem**
- The specs claim a bijective CNL↔DSL mapping, but the two languages are not isomorphic:
  - CNL allows parentheses for grouping and explicit predicate syntax (e.g., `HasFever(Alice)`), while DSL forbids parentheses.
  - DSL uses `$`-prefixed variables; CNL uses bare identifiers.
  - DSL has constructs without CNL equivalents (`Xor`, `ProbQuery`, `Weight`, `@:kbName`), and CNL has constructs not representable in the DSL/AST (nested terms, numeric terms).

**Solution**
mentioenaza ca DSL-ul e mai puternic, dar ca tot ce poate fi exprimat in CNL poate fi exprimat in DSL. asigura-et de asta. 
Ideea e ca in DSl putem compila spre kernel lucrui mai low level, si trebuie s ane asiguram ca interpretarea teoriilor din @theories este comprehensiva, completa, deci cred ca fisierele dea colo ar trebuis a aiba doar fisiere .dsl ca sa fim mai exacti siiilexibili 


## 2) Predicate Signature Declarations Are Missing

**Problem**
- Type checking requires predicate arity and argument types, but DSL lacks a formal way to declare them.
- Examples use `@pred:pred __Atom`, which declares a constant/type, not a predicate signature.
- CNL parsing/typing cannot be implemented without an authoritative predicate signature source.

**Solution**
**Introduce a formal vocabulary section** in `.sys2` (still inside DSL, no external schema files).  
Adauga specificatii toate tipurile de atomi de care e nevoie, adauga ind eclaratii informatie despre aritate, tipuri, etc fa sa fie ceva generic si util

## 3) Variable vs Constant Disambiguation in CNL

**Problem**
- CNL uses bare identifiers for both variables and constants.
- It is unclear whether a bare identifier is a variable (free) or a constant when it is not introduced by a quantifier.
- This enables multiple parses for the same sentence (e.g., `Alice trusts Bob.`).

**Solution**

**Require explicit variable markers** in CNL (`$x`) for variables only (aligns with DSL).


## 4) CNL Grammar Underspecified (`verbPhrase`, `adjective`, etc.)

**Problem**
- DS05 EBNF references `verbPhrase` and `adjective` without definitions.
- Deterministic parsing depends on a precise mapping from surface phrases to predicates.

**Solution**
1) **Define full grammar** for verb phrases, adjectives, prepositions, and mapping rules.

## 5) Anaphora Is Forbidden but Examples Use It

**Problem**
- Pronouns/anaphora are forbidden, yet examples use "that Protein" or similar references.
- This requires reference resolution not described in the grammar or pipeline.

**Solution**
**Define a minimal anaphora rule** (e.g., "that <Noun>" binds to the nearest quantified noun phrase in the same sentence).


## 6) CNL Parsing Depends on Vocabulary (Parser vs Typing Boundary)

**Problem**
- DS18 requires `vocab` for translation, but DS06 describes a syntax-first pipeline.
- Without a clear boundary, parsing becomes contextual and stateful.

**Solution**

3) **Hybrid**: parse to an ambiguous AST, then disambiguate using vocab with deterministic tie-breaking.

## 7) Functional Terms and Numerals Are Unsupported in Core AST/DSL

**Problem**
- CNL allows nested terms (e.g., `Succ(n)`, `Age(p1, 16)`), but the typed AST only supports variables/constants.
- DSL does not define function symbols or numeric literals as terms.

**Solution**
 **Extend CNL and DSL** to include function symbols and numeric literals as terms.

## 8) Block Semantics for Multiple Statements Are Ambiguous

**Problem**
- CNL blocks allow multiple statements; DSL requires a single `return` expression.
- The semantics of multi-line blocks are not defined (implicit `And` vs last-statement).

**Solution**
 **Define implicit `And`** over all statements in a block.



## 9) Proof Format Is Not Part of the CNL Grammar

**Problem**
- DS20 introduces proof blocks with keywords (`Proof`, `Given`, `Apply`, etc.) not in CNL grammar or reserved words.
- It is unclear if this is a separate language or an extension.

**Solution**
 **Extend CNL** to include proof constructs and update reserved keywords.  Trebuie sa putem verifica  un proof in CNL si sa il parsam in DSL si sa-l verificam. Fa sa fie cit mai natural

## 10) Error Codes Are Inconsistent Across Specs

**Problem**
- DS08 defines codes not listed in DS16 and uses different names for the same error.
- Implementations cannot know which code is normative.

**Solution**
**Adopt a superset**: DS16 lists all codes and aliases from other specs.


## 11) Schema Engine Needs a Model for Non-Instantiated Elements

**Problem**
- DS04 detects violations using a model from the solver, but uninstantiated elements have no corresponding wires.
- The solver cannot assign values to variables that do not exist in the circuit.

**Solution**
Analizeaza mai bien si ofera-mi explicatii despre avanele si dezavnatajele solutiilo, diocumenteaza aici
1) **Force instantiation of all domain elements** used by schemas before model checking (full grounding for domain elements only).
2) **Generate candidate instances on demand** by compiling `Body(d)` for each `d` and adding the wires to the model-checking set.
3) **Use three-valued semantics** for schema checks (unknown values do not trigger instantiation).
4) **Require backends to return partial models plus evaluation hooks** that can compute `Body(d)` lazily.

## 12) Domain Hierarchies/Subtyping Are Not Defined

**Problem**
- Type checking assumes fixed domains, but no rules define subtyping (e.g., `Patient` vs `Person`).
- It is unclear if quantifiers over `Person` include `Patient` instances.

**Solution**
2) **Explicit subtyping declarations** (e.g., `Patient <: Person`) and define quantifier expansion to include subtypes.


## 13) Kernel API Async Contract Is Unclear

**Problem**
- DS00 declares async constructors (`Promise<NodeId>`) which may impose heavy overhead.
- The spec does not explain why async is required or where concurrency is expected.

**Solution**
2) **Keep async but justify it** (e.g., worker-thread execution) and provide a sync adapter for hot paths.


## 14) Cross-Process ID Stability for Certificates Is Undefined

**Problem**
- Node IDs are stable only within a process, but certificates/proofs may be checked elsewhere.
- DS14/DS11 do not specify an ID mapping for proofs across processes.

**Solution**
1) **Use canonical encodings**: certificates reference normalized CNF/UBH problems, not raw node IDs.

## 15) Certificate Kinds List Omits `MODEL`

**Problem**
- DS14 defines certificate kinds but the SAT witness format uses `MODEL`, which is not in the list.

**Solution**
3) **Separate witness format** from certificate format (explicitly documented).

## 16) CNL `load` + Vocabulary Merge Rules vs Declarations in CNL

**Problem**
- CNL allows declarations that translate into DSL KB names.
- The no-shadowing policy + CNL declarations can lead to collisions, but collision handling in CNL is not specified.

**Solution**
3) **Support aliases in CNL** mirroring `@local:GlobalName`.

## 17) Keyword/Reserved Word Conflicts vs Proof Keywords

**Problem**
- DS19 defines reserved keywords for CNL/DSL; DS20 introduces new proof keywords not reserved.
- This can cause ambiguity if the same words are used as vocabulary symbols.

**Solution**
1) **Add proof keywords** to the CNL reserved list.

## 18) Natural-Pattern Name Normalization Is Underspecified

**Problem**
- The mapping from surface phrases to predicate symbols is not defined:
  - casing (`gene A` → `GeneA`?),
  - spacing/underscores (`has fever` → `has_fever` or `HasFever`?).
- Tests assume a mapping but the spec does not state it.

**Solution**
1) **Define a normalization function** (e.g., remove spaces, camelCase, preserve case).

## 19) `Rule` / `Theorem` / `Axiom` Semantics Are Unclear

**Problem**
- CNL describes these blocks but does not define their effect on the theory (assertion vs goal vs metadata).
- The translator handles `Rule`/`Definition` but ignores `Theorem`/`Axiom`.

**Solution**
Nu pot lua o decizie, explica optiunile, avataje sau dezavantaje, tot aicxi si revenim in iteratia urmatoare
  O1 **Treat all as assertions** (with metadata only).  
  O2 **Treat `Theorem` as a goal/obligation** that must be proved at load time (could be optional).
  O3 **Split into "assert" vs "check" blocks** with explicit semantics in DSL.

## 20) Boolean Domain vs Predicate-0-Arity Ambiguity

**Problem**
- DSL examples use `Bit` domain and then `Implies a b` where `a` and `b` are constants, not predicates.
- This blurs the line between 0-arity predicates and domain elements.

**Solution**
1) **Define 0-arity predicates explicitly** (allow predicate names without args).


