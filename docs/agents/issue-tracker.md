# Issue tracker: GitHub

This repository will use GitHub Issues once a GitHub remote is configured.

Until that remote exists, do not create issues, PRDs, or tickets through a CLI or external service. Keep planning material in repository documentation and obtain user approval before publishing anything.

After a remote exists, use the GitHub CLI for issue operations:

- Create: `gh issue create`
- Read: `gh issue view <number> --comments`
- List: `gh issue list`
- Update labels: `gh issue edit <number> --add-label` or `--remove-label`
- Close: `gh issue close <number>`

When an agent workflow says to publish or fetch an issue, use GitHub Issues only after the remote is configured and the user has authorized the action.
