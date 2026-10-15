# Publishing

The package name is `reelfetch`. Registry availability was checked during initial development; it is not reserved until published.

1. Log in to the intended npm account using `npm login` in your terminal.
2. Run `npm whoami` and confirm the account.
3. Run `npm run check`, `npm test`, and `npm pack --dry-run`.
4. Run `npm publish --access public`; complete npm's authentication prompt if requested.
5. Verify with `npm view reelfetch version` and install in a clean directory.
6. Replace the pre-release installation paragraph in README with `npm install -g reelfetch`.

The package contains only `bin/`, `src/`, README, LICENSE, and package metadata. Tests, local data, and artwork stay in the GitHub repository. The author and committer identity is Ananya Kaul <kaul23ananya@gmail.com>.
