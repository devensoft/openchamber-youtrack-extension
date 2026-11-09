# YouTrack tracker for OpenChamber

A YouTrack tracker provider for OpenChamber. It is a pure tracker: there is no
rail panel and no project-selection state in the extension. Requires OpenChamber
2.7 or newer.

## Install

1. Open **Settings → Extensions** in OpenChamber.
2. Add this repository's Git URL.
3. Approve the local service, the tracker role, session events, and the `git`
   command it uses.
4. Open **Settings → Integrations → Extension accounts → YouTrack**, enter the
   server address, and connect a permanent token with the **YouTrack** scope.
5. Map YouTrack projects to OpenChamber projects under **Settings →
   Integrations** (native project mapping).
6. Open **Issues and PRs** or the composer's **Link YouTrack Issue** picker.

## Repository mapping

The service reads the current project folder's git remote, searches YouTrack
issues for that repository, and uses the issue whose description carries the
matching JSON as the source of truth. The list is scoped to that issue's
YouTrack project and filtered to the issues whose description names the
repository.

The folder comes from one of two places:

- The host may pass it on `items.list`. When it does, that is the precise
  source.
- Otherwise the service uses the most recent top-level session folder from
  OpenChamber's session events. A worktree is resolved to its main checkout
  first, so its shared git remote still matches. The last folder is kept in the
  service data folder, so an idle service restart does not lose it.

With several projects active at once, the most recently started top-level turn
wins. The host field, when available, avoids that ambiguity.

Put the JSON in the description of an issue in the YouTrack project, as a
fenced block with an optional language tag:

```json
{
  "repoUrl": "https://github.com/acme/example.git",
  "ocProjectName": "example",
  "ignoredField": "ignored"
}
```

- `repoUrl` accepts a full GitHub/ssh URL, `github.com/owner/repo`,
  `owner/repo`, or a bare repository name. `gitRemote`, `githubUrl`,
  `repositoryUrl`, `remote`, `repo`, `repository`, `repoName`,
  `repositoryName`, `ocProjectName`, `projectName` and the `youtrackProject*`
  aliases are also read.
- `ocProjectName` is the OpenChamber project display name, not necessarily the
  repository name. It is the fallback when the repository is not available.
- Unknown fields, assignees and other metadata are
  ignored. Assignee/reporter come from the issue fields.
- The description may be fenced JSON or bare JSON. Prose and unknown fields
  are ignored.

The native mapping under **Settings → Integrations** still lists every
YouTrack project. The Issues and PRs board lists every project by default.
The composer's **Link YouTrack Issue** picker is scoped when the service has a
folder: either the host-provided directory or the latest top-level session
folder. An explicit project selection is not repository-filtered.

An unscoped To do or In progress filter asks each visible project for its own
state names. Above 40 visible projects it uses the common YouTrack workflow
names to stay inside the list deadline; a custom workflow with different names
may not match in that large-project case.

## Upgrading from 0.1

The rail panel and its `youtrack-extension-projects.json` selection are gone.
The old selection is not migrated because there is no panel selection any more;
use the native project mapping under **Settings → Integrations** instead.

## Development

```bash
bun install
bun run build
bun run test
bun run verify
bun run package
```

See [AGENTS.md](AGENTS.md) for the repository rules and release flow.
