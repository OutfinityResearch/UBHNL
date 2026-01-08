# DS-022: Complete Grammar Specification

## Goal

Provide the complete, deterministic grammars for:
- **CNL** (DS-005), and
- **Sys2 DSL** (DS-008),
including shared proof constructs and all referenced productions.

The grammars are descriptive and intended to be unambiguous for implementation.

---

# PART 1: CNL Grammar (EBNF)

```ebnf
cnlDocument   := (cnlStatement | cnlBlock)* ;

cnlStatement  := loadStmt
               | declaration "."
               | aliasDecl "."
               | subtypeDecl "."
               | fact "."
               | simpleRule "."
               | conditional "."
               | query "?"
               | proofBlock ;

cnlBlock      := quantBlock
               | namedBlock ;

namedBlock    := ruleBlock | axiomBlock | theoremBlock | definitionBlock ;

ruleBlock     := "Rule" IDENT ":" INDENT cnlStatement+ DEDENT ;
axiomBlock    := "Axiom" IDENT ":" INDENT cnlStatement+ DEDENT ;
theoremBlock  := "Theorem" IDENT ":" INDENT theoremSections DEDENT ;
theoremSections := "Given:" INDENT cnlStatement+ DEDENT
                  "Conclude:" INDENT cnlStatement+ DEDENT ;
definitionBlock := "Definition" IDENT "(" paramList ")" ":" INDENT cnlStatement+ DEDENT ;

quantBlock    := quantHead ":" INDENT cnlStatement+ DEDENT ;
quantInline   := quantHead ":" sentence ;   # allowed in proof sections

proofBlock    := "Proof" IDENT ":" INDENT proofSection+ DEDENT ;
proofSection  := proofLabel ":" INDENT proofStmt+ DEDENT ;
proofLabel    := "Given" | "Assume" | "Apply" | "Derive" | "Observed"
               | "Hypothesis" | "Verify" | "Constraint" | "Contradiction"
               | "Query" | "Found" | "Therefore" ;
proofStmt     := sentence "." | noteLine | quantInline ;
noteLine      := NOTE_TEXT ;

loadStmt      := "load" STRING ;

declaration   := "Let" IDENT "be" "a" "Domain"
               | "Let" IDENT "be" "a" TYPE
               | "Let" identList "be" TYPE ("s")?
               | IDENT "is" "a" "Domain"
               | IDENT "is" "a" TYPE ;

aliasDecl     := "Alias" IDENT "as" IDENT ;
subtypeDecl   := IDENT "is" "a" "subtype" "of" IDENT ;

simpleRule    := "Every" TYPE "with" predPhrase "has" predPhrase
               | "Every" TYPE "that" verbPhrase verbPhrase
               | "Anyone" "who" verbPhrase "is" adjective
               | "Given" sentence "," ("then")? sentence ;

quantHead     := ("For" ("any"|"all"|"every"|"each") | "Each" | "Every")
                 binder ("," binder)* ;
binder        := TYPE (VAR | IDENT) ("," (VAR | IDENT))* ;
paramList     := TYPE (VAR | IDENT) ("," TYPE (VAR | IDENT))* ;

sentence      := conditional | fact | simpleRule | explicitPred ;

fact          := subject predPhrase
               | subject "is" adjective
               | explicitPred ;

explicitPred  := IDENT "(" termList ")" ;

conditional   := "If" expr "then" expr ;

query         := ("Which" TYPE VAR? expr)
               | ("Find" "a" TYPE VAR? "such" "that" expr) ;

expr          := orExpr (("implies"|"iff") orExpr)? ;
orExpr        := andExpr ("or" andExpr)* ;
andExpr       := unaryExpr ("and" unaryExpr)* ;
unaryExpr     := negation unaryExpr | atomExpr ;
negation      := "not" | "does" "not" | "is" "not" ;

atomExpr      := explicitPred
               | subject predPhrase
               | subject "is" adjective
               | "(" expr ")" ;

subject       := term | "(" subject ")" ;

term          := VAR
               | IDENT
               | NUMBER
               | funcTerm
               | "(" term ")" ;

funcTerm      := IDENT "(" termList ")" ;
termList      := term ("," term)* ;

verbPhrase    := predPhrase ;
predPhrase    := IDENT (IDENT)* ;
adjective     := IDENT ;

identList     := IDENT ("," IDENT)* ;

VAR           := "$" IDENT ;
IDENT         := [a-zA-Z_][a-zA-Z0-9_]* ;
NUMBER        := DIGIT+ ("/" DIGIT+)? | DIGIT+ "." DIGIT+ ;
STRING        := "\"" CHAR* "\"" ;
NOTE_TEXT     := /.+/ ;
```

Notes:
- Indentation (`INDENT`/`DEDENT`) is Python-style and significant.
- Parentheses are allowed in CNL for grouping/disambiguation.

---

# PART 2: Sys2 DSL Grammar (EBNF)

```ebnf
program      := (statement)* ;

statement    := loadStmt
              | declaration
              | typing
              | namedExpr
              | anonExpr
              | assertStmt
              | checkStmt
              | vocabBlock
              | aliasDecl
              | subtypeDecl
              | quantified
              | definition
              | probWeight
              | probQuery
              | kbNaming
              | proofBlock
              | COMMENT ;

loadStmt     := "load" STRING ;

vocabBlock   := "Vocab" (vocabStmt)* "end" ;
vocabStmt    := "Domain" IDENT
              | "Const" IDENT IDENT
              | "Pred" IDENT (IDENT)*
              | "Func" IDENT (IDENT)+
              | "SubType" IDENT IDENT
              | "Alias" IDENT IDENT ;

aliasDecl    := "Alias" IDENT IDENT ;
subtypeDecl  := "SubType" IDENT IDENT ;

declaration  := "@" IDENT (":" IDENT)? "__Atom" ;
typing       := "IsA" term IDENT ;

namedExpr    := "@" IDENT (":" IDENT)? expr ;
anonExpr     := expr ;
kbNaming     := "@" ":" IDENT ;

quantified   := "@" IDENT (":" IDENT)? quantifier IDENT "graph" IDENT
                    (statement)*
                    "return" "$" IDENT
                "end" ;

definition   := "@" IDENT ":" IDENT "graph" (IDENT)+
                    (statement)*
                    "return" "$" IDENT
                "end" ;

probWeight   := "Weight" "{" literal "}" NUMBER ;
probQuery    := "@" IDENT (":" IDENT)? "ProbQuery"
                    "Ask" "{" expr "}"
                    ("Given" "{" expr "}")?
                "end" ;

proofBlock   := "@" IDENT (":" IDENT)? "Proof"
                    (proofSection)+
                "end" ;

proofSection := proofLabel proofStmt+ ;
proofLabel   := "Given" | "Assume" | "Apply" | "Derive" | "Observed"
              | "Hypothesis" | "Verify" | "Constraint" | "Contradiction"
              | "Query" | "Found" | "Therefore" ;
proofStmt    := expr | "Note" STRING ;

assertStmt   := "Assert" expr ;
checkStmt    := "Check" expr ;

quantifier   := "ForAll" | "Exists" ;

expr         := connective
              | predApply
              | term ;

connective   := "And" term term (term)*
              | "Or" term term (term)*
              | "Not" term
              | "Implies" term term
              | "Iff" term term
              | "Xor" term term ;

predApply    := IDENT (term)* ;

literal      := predApply
              | "Not" "{" predApply "}" ;

term         := "$" IDENT
              | IDENT
              | NUMBER
              | "true" | "false"
              | "{" expr "}" ;

NUMBER       := DIGIT+ ("/" DIGIT+)? | DIGIT+ "." DIGIT+ ;
IDENT        := [a-zA-Z_][a-zA-Z0-9_]* ;
STRING       := "\"" CHAR* "\"" ;
COMMENT      := ("#" | "//") .* EOL ;
```

Notes:
- DSL does not allow parentheses; use `{ }` for grouping.
- Keywords are case-sensitive; identifiers are case-sensitive.

---

# PART 3: Shared Productions

The following productions are shared conceptually across CNL and DSL:
- Proof section labels (`Given`, `Assume`, `Apply`, `Derive`, `Observed`, `Hypothesis`, `Verify`,
  `Constraint`, `Contradiction`, `Query`, `Found`, `Therefore`).
- `Note` entries (CNL narrative → DSL `Note "..."`).

---

# References

- DS-005 (CNL syntax and lexicon)
- DS-008 (Sys2 DSL syntax)
- DS-020 (Proof format)
