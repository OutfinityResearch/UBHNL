# Raport Flash Review - UBHNL Specifications

Acest raport identifică discrepanțele, erorile și contradicțiile găsite în documentația și specificațiile proiectului UBHNL.

## 1. Fișiere Lipsă
*   **`docs/specs/UBH-SPEC.md`**: Referențiat în `index.html` și `architecture.html`, dar fișierul nu există. Specificația de bază pare să fie acum `DS00-vision.md` sau `docs/specs/src/system-spec.md`.

## 2. Documentație HTML Învechită
Documentele HTML din folderul `docs/` sunt semnificativ desincronizate față de specificațiile `DSxx`:
*   **Sintaxă Predicate**: `languages.html` folosește `geneA(c)` (camelCase și paranteze), în timp ce `DS05` și `DS08` impun PascalCase (`HasFever`) și **interzic parantezele** în DSL/CNL.
*   **Lexicon JSON**: `languages.html` prezintă formatul JSON ca fiind principal, deși `DECISIONS.md` și `AGENTS.md` îl declară **DEPRECATED/LEGACY**, mutând cunoștințele de domeniu în fișiere `.cnl`.
*   **Variabile de Query**: `languages.html` folosește sintaxa `?c` pentru "query holes", care nu este definită în elementele lexicale din `DS08` (care folosește `$var`).

## 3. Inconsistențe în Specificațiile DS (Normative)
*   **`DS-005` (CNL)**:
    *   **Eroare în Exemplu (linia 76)**: Blocul `ForAll` are `return $c2`, unde `$c2` este doar unul dintre fapte (`IsSick $x`), ignorând restul corpului regulii. Corect ar fi să returneze implicația (`$imp`), așa cum apare în `DS-08`.
    *   **Încălcare Regula Pronume (linia 412)**: Exemplul "Every Cell that expresses a Protein activates **it**" folosește un pronume, deși Regula 4 din același document interzice explicit pronumele.
*   **`DS-018` (Translator)**:
    *   **Regula T18 (linia 410)**: Folosește paranteze în mapările de alias (`HasFever($1)`), ceea ce contravine interdicției globale a parantezelor în DSL (`DS-08`).
*   **Comentarii**:
    *   Inconsistență între `DS-005` (permite `//` și `#` în CNL), `DS-018` (permite doar `//` în CNL) și `DECISIONS.md`.

## 4. Recomandări Imediate
1.  Actualizarea `languages.html` și `architecture.html` pentru a reflecta eliminarea parantezelor și utilizarea PascalCase.
2.  Eliminarea referințelor către `UBH-SPEC.md` și redirecționarea către `DS00-vision.md`.
3.  Corectarea exemplului de `return` în `DS-005` pentru a asigura consistența cu `DS-008`.
4.  Standardizarea tipului de comentariu permis în CNL pentru a evita ambiguitatea la implementarea parserului.

---
*Acest raport a fost generat pentru a asigura integritatea specificațiilor.*
