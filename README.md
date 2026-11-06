# YouTrack tracker for OpenChamber

A YouTrack tracker provider for OpenChamber.

## Install

1. Open **Settings → Extensions** in OpenChamber.
2. Add this repository's Git URL.
3. Approve **Run a local service** and **Acts as the tracker**.
4. Open **Settings → Extension accounts → YouTrack**, enter the server
   address, and connect a permanent token with the **YouTrack** scope.
5. Open the **YouTrack** rail panel, choose the projects you use, and **Save**.
6. Open **Issues and PRs** and pick **YouTrack**.

## Choosing projects

Tick the projects in the **YouTrack** rail panel and **Save**. The board and
the composer's **Link YouTrack Issue** picker show those projects.

## Development

```bash
bun install
bun run build
bun run test
bun run verify
bun run package
```

See [AGENTS.md](AGENTS.md) for the repository rules and release flow.
