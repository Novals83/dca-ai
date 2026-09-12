# Contributing

The community edition is MIT licensed. You may clone, fork, modify and redistribute it under the license.

## Propose a change

1. Fork the repository and create a topic branch.
2. Keep the change focused and explain the problem and expected behavior in your pull request.
3. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` (Node.js 22), or use the Docker environment documented in the README.
4. Open a pull request against `main`. All files are owned by @Novals83. Contributions need the owner's approval and passing `verify` checks; new commits invalidate earlier approvals.

Do not commit credentials, `.env` files, private keys, personal portfolio data or build output. CI for outside contributors requires a maintainer's approval before execution. Review workflow and dependency changes carefully before approving execution.

Public access does not grant write or merge permission. The repository owner retains GitHub's administrator override for maintenance; routine contributions should follow the pull request process.
