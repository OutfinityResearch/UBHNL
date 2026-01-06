# Raport de Analiză a Specificatiilor (UBHNL)

Acest raport analizează documentația tehnică a proiectului UBHNL, identificând concepte obscure lipsite de pagini dedicate, evaluând calitatea specificațiilor existente și sugerând adăugiri necesare.

## 1. Concepte din Specificații Fără Pagină Dedicată

În urma analizei fișierelor `.md` din `docs/specs/` și a listei de pagini din `docs/wiki/concepts/`, au fost identificate următoarele concepte tehnice avansate care apar în textul specificațiilor (în special DS-010 și DS-011) dar nu beneficiază de o pagină explicativă dedicată în wiki:

*   **Alethe**: Menționat în DS-011 ca format de "proof object" pentru SMT.
*   **Farkas Lemma** (Lema lui Farkas): Menționată în DS-010 și DS-011 în contextul certificatelor pentru aritmetică liniară (LIA).
*   **Bit-blasting**: Proces menționat în DS-003, DS-011 și DS-012 ca metodă de "lowering", dar nedescrise procedural.
*   **Skolem Functions**: Menționate în DS-011 (QBF).
*   **SyGuS** (Syntax-Guided Synthesis): Menționat în DS-011.

### Concept Obscur Analizat: Lema lui Farkas (Farkas' Lemma)

Deși este un rezultat fundamental în optimizarea liniară, este puțin probabil ca un programator generalist (fără background în metode formale sau cercetare operațională) să îl cunoască.

**Context în UBHNL**: Apare în `DS-010` (`Frag_SMT_LIA`) și `DS-011` ca metodă de a genera certificate de "infezabilitate" pentru constrângeri liniare întregi (relaxed to reals) sau reale.

**Definiție Simplificată**: Lema lui Farkas oferă o modalitate de a *dovedi* că un sistem de inecuații liniare nu are soluție. Dacă avem un sistem $Ax \le b$ care este imposibil de satisfăcut, Lema lui Farkas spune că există un vector de multiplicatori $y \ge 0$ astfel încât combinația liniară a inecuațiilor duce la o contradicție evidentă (e.g., $0 \le -1$).

**Importanță în Proiect**: Pentru a respecta principiul "don't trust the solver, verify" (DS-011), un backend care raportează `UNSAT` pentru o problemă aritmetică trebuie să returneze acest vector $y$. Verificatorul (Trusted Core) poate apoi să calculeze simplu $y^T A$ și $y^T b$ pentru a confirma contradicția, fără a trebui să rezolve din nou problema complexă de optimizare. Lipsa unei pagini dedicate face ca implementarea verificatorului pentru `Frag_SMT_LIA` să fie obscură pentru un nou contributor.

## 2. Analiza Specificațiilor (Observații)

Analiza fișierelor Markdown din `docs/specs/` și `docs/specs/DS/`.

### Neclare / Interpretabile
*   **DS-008 (DSL) - Inferența de tip "Subject-first"**: Sintaxa `@s P ...` este descrisă ca "introduces (or selects) the definition target". Nu este complet clar ce se întâmplă în cazul re-declarării implicite parțiale. Dacă `@s:Type` apare într-un fișier și `@s` (fără tip) în altul, ordinea de încărcare devine critică dacă inferența eșuează. Specificația menționează "inconsistent inferred type" ca eroare, dar nu detaliază algoritmul de unificare a tipurilor peste mai multe fișiere.
*   **DS-004 (Schema Engine) - Politica de Instanțiere**: Se menționează o "Default policy" (batch per schema). Nu este clar unde este definită această politică în cod sau configurație (hardcoded vs config file). Pentru un sistem care se vrea modular, lipsa definiției config-ului este o ambiguitate.
*   **Terminologia "Bit" vs "Boolean"**: În UBH-SPEC, `Bit` este folosit excesiv pentru tipuri logice. Deși tehnic corect (`{0,1}`), distincția semantică în straturile superioare (CNL) între un boolean logic și un bit dintr-un bitvector nu este întotdeauna clar delimitată în explicațiile de "lowering".

### Incomplete
*   **Probabilistic Layers (`Frag_Prob`)**: UBH-SPEC menționează "probabilistic layers" ca fiind un "front-end". DS-010 și DS-011 menționează fragmentele (`Frag_Count`, `Frag_Prob`), dar nu există niciun DS care să explice *cum* se face integrarea. Cum arată o interogare probabilistică în DSL? Cum se reprezintă incertitudinea în `SessionState`? Această parte a sistemului este "sub-specificată" masiv comparativ cu partea logică.
*   **Conexiunea cu GAMP**: Directorul `docs/gamp/` există și conține fișiere URS/FS, sugerând un context de validare reglementată (industrie farmaceutică/medicală?). Totuși, niciun fișier din `docs/specs/` nu face referire la acest director. Un dezvoltator care citește doar specificațiile tehnice ar putea ignora complet cerințele stricte de trasabilitate impuse de GAMP.
*   **Certificate verification procedure**: DS-011 definește *ce* certificate sunt necesare, dar nu *cum* sunt invocate verificatoarele. Sunt binare externe? Sunt funcții JS în "trusted core"? Specificația interfeței `check(...)` este prea abstractă (`details?`).

### Erori Potențiale (Minor)
*   **UBH-SPEC**: Secțiunea 3 "Semantics" definește `VAL(XOR(a,b)) = VAL(a) + VAL(b)`. Ar trebui explicitat `+ (mod 2)` chiar dacă contextul GF(2) este menționat mai jos, pentru rigoare matematică absolută în definiția recursivă.

## 3. Sugestii pentru Noi Fișiere DS

Pentru a completa golurile identificate, se recomandă adăugarea următoarelor specificații de design:

1.  **DS-013: Probabilistic Engine & Reasoning**:
    *   **Scop**: Detalierea funcționării fragmentelor `Frag_Prob` și `Frag_WMC`.
    *   **Conținut**: Sintaxa DSL pentru probabilități, algoritmul de reducere la Weighted Model Counting (WMC), formatul certificatelor pentru inferență aproximativă.

2.  **DS-014: Certificate Formats & Verification**:
    *   **Scop**: Standardizarea formatelor de certificate pentru interoperabilitate.
    *   **Conținut**: Specificarea exactă a formatelor acceptate (e.g. subsetul Alethe suportat, formatul JSON pentru certificate de optimizare), și protocolul de comunicare cu verificatoarele externe.

3.  **DS-015: GAMP Compliance & Traceability Matrix**:
    *   **Scop**: Legarea specificațiilor tehnice de cerințele utilizatorului (URS) din `docs/gamp/`.
    *   **Conținut**: O matrice care mapează cerințele din `docs/gamp/URS.md` la fișierele DS specifice și la testele de acceptanță. Acest lucru este crucial dacă proiectul chiar urmează GAMP.

4.  **DS-016: Error Handling & Diagnostics**:
    *   **Scop**: Unificarea raportării erorilor.
    *   **Conținut**: DS-006 menționează categorii de erori, dar un sistem complex cu orchestrator și backends multiple are nevoie de o taxonomie a erorilor (User vs System vs Solver) și un format standard de raportare a "blame"-ului (cine e de vină: utilizatorul, logica, sau limitarea solverului?).
