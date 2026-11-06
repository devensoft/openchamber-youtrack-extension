# OpenChamber YouTrack extension

A [YouTrack](https://www.jetbrains.com/youtrack/) integration for
[OpenChamber](https://github.com/openchamber/openchamber).

**Status: v0.1.0 scaffolding.** The extension installs and draws a hello-world
rail panel. It does not talk to YouTrack yet; the tracker provider and its
project/issue views land in later versions.

## Install

OpenChamber loads extensions from a folder or a Git repository. This repo is
already an installable extension: the built bundle (`panel/main.js`) is
committed, so no build step runs at install time.

1. Open **Settings → Extensions** in OpenChamber.
2. Add this repository's Git URL:
   `https://github.com/devensoft/openchamber-youtrack-extension`
3. Open the **YouTrack** rail panel. It shows the version and the host surface
   it mounted on.

Alternatively, download the release zip, unzip it into
`~/.config/openchamber/extensions/openchamber-youtrack-extension`, and restart
OpenChamber.

Extensions load in OpenChamber web and desktop. The phone app and the VS Code
extension host do not load extensions in 2.6.x.

No capability approval is needed for v0.1.0: the panel reads the host theme,
directory and surface only.

## Requirements

- [Bun](https://bun.sh) 1.2 or newer
- OpenChamber 2.6.0 or newer

## Develop

```bash
bun install
bun run build        # writes panel/main.js
bun run test         # manifest check + typecheck + unit tests
bun run verify       # build, then fail if panel/main.js is stale
bun run package      # dist/openchamber-youtrack-extension-v0.1.0.zip
bun run bump patch   # or minor / major
```

The panel source is `src/panel/main.ts`; `panel/index.html` loads the bundled
IIFE. OpenChamber never compiles extension code, so `panel/main.js` must be
committed and `bun run verify` must pass before merging.

To try a local build, install the folder itself via **Settings → Extensions →
Install from folder**, then reload the panel.

## Layout

```
src/panel/main.ts        panel source (TypeScript)
panel/index.html         panel document, loads main.js
panel/main.js            committed bundle — do not edit by hand
icon.svg                 the YT rail mark (our own asset, not a JetBrains logo)
scripts/build.ts         Bun.build bundler
scripts/check-manifest.ts  validates package.json against the SDK manifest schema
scripts/package.ts       stages the runtime files and writes the release zip
scripts/version-gt.ts    semver gate used by CI
scripts/bump.ts          bumps the package version
docs/agents/             agent-facing issue-tracker and domain-doc rules
```

## Trademarks

This is an unofficial integration. It is not affiliated with, sponsored by, or
endorsed by JetBrains. "YouTrack" and the YouTrack logo are trademarks of
JetBrains s.r.o.; the extension uses the product name descriptively and does not
bundle JetBrains artwork. The rail icon is our own "YT" mark.

## Release

`package.json` is both the npm package and the OpenChamber manifest
(`openchamber` key). Bump the version and merge to `main`:

```bash
bun run bump patch   # or minor / major
```

The repo-owned CI pipeline (`.github/workflows/ci.yml`) runs the tests, the
build and the committed-bundle check on every pull request and on `main`. On
`main` it tags `v{version}` — creating the GitHub release — when the version is
greater than the newest `v*` tag. `.github/workflows/publish.yml` then attaches
`openchamber-youtrack-extension-v{version}.zip` and its `.sha256` to that
release.

Git-installed extensions update through Git: bumping `version` is what makes
OpenChamber offer the update.

## Links

- [OpenChamber extension SDK](https://www.npmjs.com/package/@openchamber/sdk)
- [OpenChamber extension docs](https://docs.openchamber.dev/sdk/)

## License

MIT — see [LICENSE](LICENSE).
