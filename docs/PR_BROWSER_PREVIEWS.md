# Pull-request browser previews

EpicScope's production GitHub Pages site is built from `main`. Changes on a pull-request branch are therefore **not** visible at the production URL until they are merged.

For UI/lifecycle/rendering work where browser behavior is acceptance authority, use the on-demand PR preview workflow instead of merging merely to obtain a browser-testable build.

## Requesting a preview

On a same-repository pull request, add this exact top-level comment:

```text
/preview
```

The `Deploy PR Browser Preview` workflow will:

1. resolve the current PR head SHA;
2. build `main` as the production root;
3. type-check, test, and build the PR head separately;
4. build the PR with a dedicated Vite base path under `/EpicEFI-EpicScope/previews/pr-<number>/`;
5. deploy one Pages artifact containing the unchanged production-root build plus the requested PR preview;
6. comment the resulting preview URL and exact tested SHA back on the pull request.

A manual `workflow_dispatch` with a PR number is also supported.

## Important behavior

- The production root remains a build of `main`; preview deployment must not make the PR build the production root.
- Preview builds are limited to branches in this repository. Fork pull requests are rejected by the workflow.
- Pages has one active deployment. A later preview or normal `main` deployment can replace an earlier preview subpath. Request `/preview` again when a fresh browser build is needed.
- The preview URL is tied to the PR number, while the workflow comment records the exact head SHA that was deployed. Always compare the SHA before treating browser observations as acceptance evidence.
- CI success is necessary but does not replace browser acceptance for VE Analyzer lifecycle/render/state work.

## Vite base path

`vite.config.ts` accepts `EPICSCOPE_BASE_PATH`. Production keeps the existing default `/EpicEFI-EpicScope/`; preview builds override it with the PR-specific subpath. Local development behavior remains unchanged.

## VE Analyzer acceptance

For VE Analyzer changes, do not merge solely to test GitHub Pages behavior. Request a PR preview, verify the exact preview SHA in the browser, and record whether the relevant browser scenarios pass or fail before merging.
