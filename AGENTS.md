# AGENTS.md

Guidance for coding agents working in this repository.

## What this repo is

An OpenChamber **tracker provider** for YouTrack. The repository root is the
installable extension: `package.json` carries both npm metadata and the
OpenChamber manifest under `openchamber`. Version 0.1.0 implements the
provider (read, attach, state update, comments, live summaries) and uses
OpenChamber's native project mapping. There is no extension panel.

## Agent skills

### Issue tracker

Issues live in GitHub Issues and are handled with the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Domain docs

Single-context: read `GLOSSARY.md` at the root when it exists, and any ADRs
under `docs/adr/` when present. See `docs/agents/domain.md`.

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
  Any change under `service/` must be followed by `bun run build`, and
  `service/main.js` must be committed in the same change. Never hand-edit the
  bundle. There is no panel bundle.
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
- **Native project mapping** — `capabilities.projectMapping` is on. Settings →
  Integrations maps YouTrack containers to OpenChamber projects, and the
  board's container picker uses that mapping. The extension draws no panel.
- **Native project directory** — the host passes the open project's `directory`
  (or `projectPath`) and optionally `projectName` on `items.list` /
  `containers.list`. The service uses that folder; there is no rail panel, no
  `/projects` route and no panel state.

## Conventions

- TypeScript, ESM, Bun. `strict` and `noUncheckedIndexedAccess` are on.
- `service/main.ts` and `service/mapping.ts` are the sources;
  `service/main.js` is the committed bundle. There is no panel bundle.
- Tests run the checked-in bundle against a fake YouTrack and a callback
  listener that plays OpenChamber's outbound proxy. Add a wire test for every
  call and filter you touch.
- State categories are per-project. Infer them from `isResolved` plus the state
  name; user overrides are a later feature.
- No panel. The service does not read or write
  `youtrack-extension-projects.json`, `/projects`, or
  `tracker-accounts.json`; the host owns the account and the native mapping.
  `containers.list` returns every project, and an explicit `containerId`
  read is not scoped by the repository filter.
- The service reads the native project folder's git remote with
  `git -C <folder> remote get-url origin` (then the first remote), cached for
  five minutes. The folder basename, the native project name, the git remote
  URL and the repo name are the search identities.
- The mapping convention is read from **issue descriptions**: the service
  searches issues for those identities, parses the matched issue's fenced
  JSON, uses that issue's project as the `items.list` scope and keeps only the
  issues whose description carries the matching JSON. The project description
  is not a fallback. The test issue is the one whose description carries the
  mapping JSON; do not use other issues as a metadata source.
- The description parser accepts a fenced JSON block with an optional language
  (` ```json `), or a description that is bare JSON, and ignores unknown
  fields. Identity keys are `repoUrl`, `githubUrl`, `gitRemote`, `gitUrl`,
  `remoteUrl`, `remote`, `repositoryUrl`, `repo`, `repository`, `repoName`,
  `repositoryName`, `ocProjectName`, `projectName`, `project` and the
  `youtrackProject*` aliases. `repoUrl` accepts a full GitHub/ssh URL,
  `github.com/owner/repo`, `owner/repo`, or a bare repo name. Unknown
  fields, assignees and other metadata are ignored.
  Assignee/reporter come from issue fields, not the JSON.
- A repository match can be shared by several issues/projects; the service
  returns all matched project ids and the description filter still decides the
  items. `containers.list` stays `{ id, key, name }`.
- On a host that passes the native project directory, the composer's **Link
  YouTrack Issue** picker calls `items.list` with it, so the issue-description
  filter applies there. The host caches `/items/list` for 30 seconds; a
  directory change can therefore miss an already-used picker until the cache
  expires or the page reloads.
- The YouTrack **Type** custom field is not part of the neutral tracker shape.
  It is not a dedicated filter, badge, or create field; search can still use
  `Type: Epic`.
- macOS artefacts: `.DS_Store`, `._*` are ignored; do not commit them.

## CI and release

- `.github/workflows/ci.yml` is repo-owned and read-only. It runs the tests and
  the committed-bundle check on pull requests and `main`.
- `.github/workflows/release.yml` is manual. After the bump is on `main` it
  tests, verifies `service/main.js`, tags `v{version}`, packages the runtime
  files and attaches the zip to the release when `package.json` is greater
  than the newest `v*` tag.
- There is no private CI dependency; `bun install` works for any contributor.
