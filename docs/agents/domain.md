# Domain Docs

This is a single-context repository.

## Before exploring

- Read `GLOSSARY.md` at the root when it exists.
- Read any ADRs under `docs/adr/` when present.

If a file or folder is absent, proceed silently. Do not flag it or suggest
creating it upfront.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor
proposal, a hypothesis, a test name), use the term as defined in
`GLOSSARY.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, that is a signal: either
you are inventing language the project does not use, or there is a real gap
worth recording.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding it.
