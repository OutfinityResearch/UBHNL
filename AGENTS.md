# Agent Guidelines for UBHNL

## Language policy (repo-wide)
- Chat responses may be in Romanian.
- Repository artifacts (code, comments, docs, specs, site pages) must be written in **English**.
- Exception: temporary review notes placed at the repo root (when explicitly requested) may be in Romanian.

## DSL (Intermediate Representation) Restrictions
The DSL is a deterministic, typed, strict-vocabulary language used for long-term theory files and reproducible learn/query inputs.

### Core rules (must match DS-008)
- **Strict vocabulary**: any bare identifier must exist in the vocabulary (lexicon + exported declarations), otherwise it is a load error.

If a theory needs explicit DAG construction (for debugging or reuse), use named intermediates, but keep the one-@ rule.

## CNL (Controlled Natural Language) Guidelines
1.  **Map to DAG**: The CNL parser's job is to read "natural" sentences and explode them into the rigorous DSL DAG.
2.  **Flexibility**: CNL can look like English (Subject-Verb-Object), Math, or Logic, but it must translate deterministicly.
