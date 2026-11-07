# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a
  heredoc for multi-line bodies.
- **Read an issue**:
  `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**:
  `gh issue list --state open --json number,title,body,labels,comments`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply or remove labels**:
  `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- **Close**: post the explanation with `gh issue comment <number> --body "..."`,
  then `gh issue close <number>`.

Infer the repository from `git remote -v`; `gh` does this automatically when
run inside a clone.

File issues only into this repository. In a fork, `gh` can default to the
upstream parent, so before the first `gh issue create` of a session, check the
target with `gh repo view --json nameWithOwner` and confirm it if it is not
this repository.
