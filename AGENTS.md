# AGENTS.md

Guidance for coding agents working in this repository.

## What this repo is

An OpenChamber extension for YouTrack. The repository root **is** the extension
package: `package.json` carries both npm metadata and the OpenChamber manifest
under `openchamber`. Version 0.1.0 is scaffolding — a hello-world rail panel.
The tracker provider is not implemented yet.

## Agent skills

### Issue tracker

Issues live in GitHub Issues and are handled with the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Domain docs

Single-context: read `GLOSSARY.md` at the root (once it exists) and ADRs under
`docs/adr/`. See `docs/agents/domain.md`.

## Commands

```bash
bun install
bun run build          # bundles src/panel/main.ts -> panel/main.js
bun run test           # manifest schema check + tsc --noEmit + bun test
bun run verify         # build + fail when panel/main.js is stale
bun run package        # dist/<name>-v<version>.zip + .sha256
bun run bump patch|minor|major
```

## Non-negotiables

- **Commit the bundle.** OpenChamber installs extensions without building them.
  Any change under `src/` must be followed by `bun run build`, and
  `panel/main.js` must be committed in the same change. Never hand-edit it.
- **Pin the SDK.** `@openchamber/sdk` is pinned exactly (`2.6.1`); the manifest
  targets OpenChamber `>=2.6.0`. Bump deliberately and verify the built bundle
  still starts with an IIFE wrapper.
- **Keep the manifest valid.** `bun run test` parses `package.json` with
  `parseManifestJson` from `@openchamber/sdk/schemas`. A manifest failure is a
  hard error, not a warning.
- **Ask for the minimum capability.** The current panel needs none. Add
  `contributes.capabilities`, `origins`, `filesystem`, `service` or
  `integration` only when the feature genuinely requires it, and explain why in
  the change. The approval dialog is shown once, at install, and is the user's
  only signal.
- **Never store a token in `host.storage`.** Tokens belong to
  `contributes.integration`, managed by OpenChamber.
- **The icon is ours.** `icon.svg` is the monochrome "YT" mark. Do not replace
  it with the JetBrains/YouTrack product logo: JetBrains' licence only permits
  its logos as a secondary brand pointing to JetBrains, and this repo is MIT.
  The product name stays descriptive ("YouTrack"), the icon does not borrow
  their identity.
- **No network from the panel.** The iframe has an opaque origin and a CSP that
  blocks `fetch` except to declared origins. Use `host.request` for one
  API origin, or a local `service` for anything else.
- **Version bumps drive releases.** Do not create tags or releases by hand; CI
  owns `v*` tags.

## Conventions

- TypeScript, ESM, Bun. `strict` and `noUncheckedIndexedAccess` are on.
- Sources live in `src/`; built panel files live in `panel/`.
- The panel mounts once and repaints on every `onReady` snapshot
  (`applyHostReady` every time; DOM once).
- Use host theme variables (`--oc-bg`, `--oc-fg`, `--oc-muted`, `--oc-border`,
  `--oc-elevated`, `--oc-radius`, `--oc-font`, `--oc-mono`) instead of
  hard-coded colours.
- macOS artefacts: `.DS_Store`, `._*` are ignored; do not commit them.

## CI and release

- `.github/workflows/ci.yml` is repo-owned. It runs tests, the build and the
  committed-bundle check on pull requests and `main`. On `main`, it tags
  `v{version}` and creates the GitHub release when `package.json` is greater
  than the newest `v*` tag (`scripts/version-gt.ts` is the gate).
- `.github/workflows/publish.yml` builds, verifies the committed bundle,
  packages the runtime files and attaches the zip to the `v{version}` release.
- The pipeline is repo-owned and has no private dependencies; `bun install`
  works for any contributor.
