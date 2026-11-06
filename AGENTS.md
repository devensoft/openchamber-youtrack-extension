# AGENTS.md

Guidance for coding agents working in this repository.

## What this repo is

An OpenChamber **tracker provider** with a project selector for YouTrack. The
repository root is the installable extension: `package.json` carries both npm
metadata and the OpenChamber manifest under `openchamber`. Version 0.2.0
implements the provider (read, attach, state update, comments, live summaries)
and a rail panel that stores which projects appear.

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
bun run build          # bundles service/main.ts -> service/main.js
bun run test           # build + tsc --noEmit + bun test (fake YouTrack)
bun run verify         # build + fail when service/main.js is stale
bun run package        # dist/<name>-v<version>.zip + .sha256
bun run bump patch|minor|major
```

## Non-negotiables

- **Commit the bundle.** OpenChamber installs extensions without building them.
  Any change under `service/` or `src/panel/` must be followed by `bun run
  build`, and both `service/main.js` and `panel/main.js` must be committed in
  the same change. Never hand-edit either bundle.
- **Pin the SDK.** `@openchamber/sdk` is pinned exactly (`2.6.1`); the manifest
  targets OpenChamber `>=2.6.0`. Bump deliberately and rerun the provider tests.
- **Keep the manifest valid.** `bun run test` parses `package.json` with
  `parseManifestJson` from `@openchamber/sdk/schemas`. `service.provides:
  ["tracker"]` and `contributes.tracker` come together, and `panel.id` must be
  ≤ 28 characters because the provider id is `ext-<panel.id>`.
- **The token is OpenChamber's.** Never store a tracker token in
  `host.storage`, the service, or a file. The service gets a per-call handle;
  use `createTrackerOutbound`. Never store a handle.
- **The service is the only YouTrack egress.** No panel, no second credential,
  no direct network path. The tracker account card is under **Settings →
  Extension accounts**, not the Integrations catalog.
- **No `items.create`.** The nine calls are seven reads plus two writes; issue
  creation needs a custom panel and a separate credential. Do not promise it as
  part of the provider.
- **The icon is ours.** `icon.svg` is the monochrome "YT" mark. Do not replace
  it with the JetBrains/YouTrack product logo: JetBrains' licence only permits
  its logos as a secondary brand pointing to JetBrains, and this repo is MIT.
  The product name stays descriptive ("YouTrack"), the icon does not borrow
  their identity.
- **Version bumps drive releases.** Do not create tags or releases by hand; CI
  owns `v*` tags.

## Tracker surfaces

- **Issues and PRs board** — the full list/detail UI; the provider appears
  beside Linear. This is the browse/search surface, not a panel we draw.
- **Composer `+` / item picker** — attach, start a worktree.
- **Linked items and live states** — `items.liveSummaries` for tracked items.
- **Rail Tracker** — tracked items for the current session or branch; it is not
  the full list.
- **YouTrack rail panel** — the project selector. It reads/writes `/projects`
  through the service and sets which containers the board and Group picker show.
  `panel.entry` is present for this panel.

## Conventions

- TypeScript, ESM, Bun. `strict` and `noUncheckedIndexedAccess` are on.
- `service/main.ts` is the source; `service/main.js` is the committed bundle.
- Tests run the checked-in bundle against a fake YouTrack and a callback
  listener that plays OpenChamber's outbound proxy. Add a wire test for every
  call and filter you touch.
- State categories are per-project. Infer them from `isResolved` plus the state
  name; user overrides are a later feature.
- Project visibility is set by the rail panel. The service stores the mode
  (`all` or `selected`), the selection, the last known project list and the
  current user id under `~/.config/openchamber/youtrack-extension-projects.json`
  (or `$XDG_CONFIG_HOME/openchamber` on Linux/macOS,
  `%APPDATA%\openchamber` on Windows) and filters `containers.list` and the
  unscoped `items.list`. Explicit `containerId` reads are not filtered, so
  tracked items and links still resolve. The default mode is `all`; an empty
  selection is refused in `selected` mode, while `all` keeps the saved
  selection so a switch back restores it. `auth.verify` preloads the project
  list with the handle from connecting the account, so the panel does not wait
  for the first board call. No names are hardcoded. The host mapping UI stays
  off. Automatic session comments remain off too.
- A disconnect removes OpenChamber's account but does not stop the extension
  service. `GET /projects` therefore checks OpenChamber's
  `tracker-accounts.json` for a valid `ext-youtrack` account before returning
  the cached list. It reads only the instance and account `status`, never the
  `credential`; an unreadable store is `unknown` and keeps the cache. With no
  valid account the answer is `connected: false`, no projects, and
  `needsLoad: true`, so the panel shows the connect prompt. The panel also
  refreshes on window focus and visibility change, redrawing only when the
  answer changed.
- Project access is inferred from the project team (`team.users`,
  `team.allUsersGroup`) and the leader. YouTrack's `/api/assignedRoles` needs
  **Update Project**, so a normal token gets 403 and cannot read effective
  roles. Treat the label as a team-membership signal, never as an enforced
  permission. `loadProjects` keeps `access` in the panel cache;
  `containers.list` maps to the neutral `{ id, key, name }` shape and never
  sends `access` to the host.
- A fresh panel starts with no boxes ticked. Row clicks toggle the box; Select
  all and Unselect all cover the bulk cases. Search filters by name/key;
  the list groups Can edit, Read only, then Access unknown, alphabetical inside
  each group. There is no header Refresh; the conditional Reload only re-reads
  the service after the tracker has filled in access.
- `service/main.ts` and `src/panel/main.ts` are the sources; both built files
  are committed. The panel talks only through `host.serviceRequest`.
- The composer's **Link YouTrack Issue** picker calls the unscoped
  `items.list`, so the service's selection filter applies there too. The host
  caches `/items/list` for 30 seconds and the picker caches its query, and the
  extension has no API to clear either. A selection change can therefore miss
  an already-used picker until the cache expires or the page reloads; do not
  claim the picker refreshes instantly.
- The YouTrack **Type** custom field is not part of the neutral tracker shape.
  It is not a dedicated filter, badge, or create field; search can still use
  `Type: Epic`.
- macOS artefacts: `.DS_Store`, `._*` are ignored; do not commit them.

## CI and release

- `.github/workflows/ci.yml` is repo-owned. It runs the tests, the service
  build and the committed-bundle check on pull requests and `main`. On `main`,
  it tags `v{version}` and creates the GitHub release when `package.json` is
  greater than the newest `v*` tag.
- `.github/workflows/publish.yml` builds, verifies `service/main.js`, packages
  the runtime files and attaches the zip to the `v{version}` release.
- There is no private CI dependency; `bun install` works for any contributor.
