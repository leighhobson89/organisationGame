# Plan: Declare the Supported Node Runtime

**Status:** Finalized; focused verification passed and scoped review found no actionable findings.

## Goal and rationale

Make the project's supported Node.js range explicit and consistent across package metadata and developer documentation. The supported range is `^20.19.0 || >=22.12.0`, which reflects the current Vite runtime requirement. The Testing Guide currently says the package has no top-level Node engine field; remove that stale omission note when the field is added.

## Scope and constraints

- Add `"engines": { "node": "^20.19.0 || >=22.12.0" }` to `package.json`.
- Keep the root package metadata in `package-lock.json` aligned with exactly the same Node range.
- Update the README and Testing Guide to state the same semver-exact range: `^20.19.0 || >=22.12.0`.
- Replace the stale Testing Guide omission note with accurate runtime guidance and retain useful context about the locked dependencies' Node requirements.
- Add or update focused metadata/documentation regression coverage only. Do not run an app build, E2E tests, or the full suite.
- Run `git diff --check`. No app behavior change is in scope; keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Declare the Node range in `package.json` and synchronize the root `package-lock.json` package entry without changing dependency versions.
2. Update README and Testing Guide runtime statements to use the exact same range and remove the stale note claiming no package engine is declared.
3. Add focused metadata/documentation verification that checks the declared range and consistent docs, then run that focused check and `git diff --check` only.
4. Complete scoped review, update relevant documentation if needed, and archive the finalized plan.

## Test plan

The Test Engineer added `tests/unit/docs/node-engine-support.test.mjs`. It checks the package engine declaration, lockfile root metadata, matching README/Testing Guide range, and removal of the stale omission note.

Focused command: `node --test --test-isolation=none tests/unit/docs/node-engine-support.test.mjs`.

Baseline: **0 passed, 1 failed.** The first assertion fails because `package.json.engines.node` is undefined instead of the expected `^20.19.0 || >=22.12.0`. No production or documentation changes had been made for this slice at baseline.

After the JavaScript specialist added matching `package.json` and package-lock root metadata, `npm pkg get engines.node` returned the expected range and the focused test advanced to documentation checks. Its next failure is that README still lacks the exact semver range; the Testing Guide still has the stale omission sentence. The documentation specialist is updating those statements before the focused rerun.

The final README wording is `Use Node.js \`^20.19.0 || >=22.12.0\` and npm.` The Testing Guide now declares the same range and retains the locked dependency versions while removing the stale note. The focused command `node --test --test-isolation=none tests/unit/docs/node-engine-support.test.mjs` passed 1/1. No app build, E2E test, or full suite was run. Scoped review found no actionable findings.

## Acceptance criteria

- [x] `package.json` declares `engines.node` exactly as `^20.19.0 || >=22.12.0`.
- [x] The root package entry in `package-lock.json` declares the identical Node engine range.
- [x] README and Testing Guide state the exact same supported range; the stale omission note is removed.
- [x] Focused metadata/documentation regression passes and `git diff --check` is clean; no app build, E2E, or full suite is run.
- [x] No application behavior changes; documentation is finalized and archived, and the separate human-playtest/content-expansion gate remains active.
