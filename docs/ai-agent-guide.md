# AI Agent Guide: Changeset Process

This guide provides programmatic approaches for AI agents to handle the changeset workflow without interactive prompts.

## Overview

The standard `pnpm changeset` command is interactive and unsuitable for AI agents. This document outlines non-interactive alternatives.

## Programmatic Changeset Creation

### Method 1: Direct File Creation (Recommended)

Create changeset files directly since they're just markdown with frontmatter:

```javascript
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function createChangeset(summary, releases) {
    const frontmatter = releases.map((r) => `'${r.name}': ${r.type}`).join('\n');

    const content = `---
${frontmatter}
---

${summary}`;

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 11);
    const filename = `${timestamp}-${random}.md`;

    writeFileSync(join(process.cwd(), '.changeset', filename), content);
    return filename;
}

// Usage:
createChangeset('Added new feature', [
    { name: '@sitchco/cli', type: 'minor' },
    { name: '@sitchco/formatter', type: 'patch' },
]);
```

### Method 2: CLI with --empty flag

```bash
pnpm changeset --empty
# Then manually edit the generated file
```

## Complete Release Workflow

### Step 1: Analyze Changes

```bash
git status
git diff          # Unstaged changes
git diff --cached # Anything already staged
```

### Step 2: Run Tests

```bash
pnpm test                              # Everything
pnpm --filter @sitchco/module-builder test  # One package
```

Do this before committing. `test-on-pr.yml` is `pull_request`-triggered only, so a
release committed straight to `main` never runs tests in CI — this local run is the
only gate. Stop here if anything fails.

### Step 3: Create Changeset

```javascript
// Determine affected packages and bump types
// Use the createChangeset function above
```

### Step 4: Stage and Commit

Commit the changeset together with the code it describes, using the repo's scoped
conventional-commit style:

```bash
git add .changeset/[filename].md
git commit -m "fix(module-builder): descriptive message"
```

### Step 5: Push Changes

```bash
git push origin main
```

### Step 6: Version Packages

```bash
pnpm run version  # NOT pnpm version
```

Review the diff before committing. Expect the changeset file to be deleted, plus a
version and CHANGELOG bump for each affected package. Workspace dependents get a
patch bump too — `.changeset/config.json` sets `updateInternalDependencies: "patch"`,
so a `@sitchco/module-builder` release also bumps `@sitchco/cli`. That is expected.

### Step 7: Commit Version Changes

```bash
git add .
git commit -m "Version Packages"
```

### Step 8: Push Version Changes

```bash
git push origin main
```

### Step 9: Create Release

```bash
pnpm run release  # Creates date-based tag and GitHub release
```

This creates the tag and GitHub release, which *triggers* CI. **Nothing has been
published to npm at this point.**

### Step 10: Verify the Publish Landed

```bash
# Watch the run the release just triggered
gh run watch "$(gh run list --workflow=publish-packages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status

# Confirm the new version is actually on the registry
npm view @sitchco/module-builder version
```

Do not skip this. Publishing happens asynchronously in GitHub Actions and can fail
*after* the tag and release already exist — expired `NPM_TOKEN`, a pnpm setup
conflict, a build error. A green `pnpm run release` says only that the release was
created, so treating it as the end of the process reports success for a release that
never shipped.

## Recovering From a Failed Publish

A failed publish leaves the commits, tag, and GitHub release intact and correct.
Nothing needs re-versioning — the packages simply were not uploaded.

1. Read the failure: `gh run view <run-id> --log-failed`
2. Fix the cause and push it to `main`
3. Re-run the publish against the fixed `main`:

```bash
gh workflow run publish-packages.yml --ref main
```

Dispatching against `main` rather than re-running the failed run matters when the fix
is to the workflow file itself: a re-run replays the workflow as it existed at the
tagged commit, which still contains the bug.

Two failure signatures worth recognizing:

- `Multiple versions of pnpm specified` — `pnpm/action-setup@v4` errors when a
  `version:` input is given alongside the `packageManager` field in `package.json`.
  Remove the input; let `packageManager` be the single source of truth.
- `npm error 404 Not Found - PUT` on a package that already exists — this is an
  auth failure, not a missing package. npm returns 404 instead of 403 so it does not
  leak package existence. Check whether `NPM_TOKEN` has expired (`gh secret list`
  shows when it was last set; granular npm tokens cap at 90 days).

## Bump Type Guidelines

- **patch**: Bug fixes, internal refactors, dependency updates
- **minor**: New features (backward compatible)
- **major**: Breaking changes
- **none**: Changes that don't require version bumps

## Package Detection

To determine which packages changed:

```bash
git diff --name-only HEAD~1 | grep "packages/" | cut -d'/' -f1-3 | sort -u
```

Or examine the modified files to infer affected packages.

## Error Handling

Always check for errors after each step:

- Verify the changeset file was created
- Confirm git operations succeeded
- Check that `pnpm run version` produced the expected diff
- Confirm the publish workflow succeeded and the version is live on npm

## Integration with Existing Workflow

The programmatic approach maintains full compatibility:

- Changesets are consumed by `pnpm run version`
- Changelog generation works automatically
- Publishing workflow remains unchanged
- CI/CD validation continues to work

## Example Complete Script

```javascript
import { execSync } from 'node:child_process';

function run(cmd) {
    execSync(cmd, { stdio: 'inherit' });
}

function capture(cmd) {
    return execSync(cmd, { encoding: 'utf8' }).trim();
}

async function createRelease(packageChanges, description, scope) {
    // Only automated gate on a direct-to-main release
    run('pnpm test');

    const filename = createChangeset(description, packageChanges);
    console.log(`Created changeset: ${filename}`);

    run(`git add .changeset/${filename}`);
    run(`git commit -m "fix(${scope}): ${description}"`);
    run('git push origin main');

    run('pnpm run version');
    run('git add .');
    run('git commit -m "Version Packages"');
    run('git push origin main');

    // Creates the tag and GitHub release. This does NOT publish.
    run('pnpm run release');

    // The release only triggers CI. Confirm the publish actually landed.
    const runId = capture(
        "gh run list --workflow=publish-packages.yml --limit 1 --json databaseId --jq '.[0].databaseId'"
    );
    run(`gh run watch ${runId} --exit-status`);

    for (const { name } of packageChanges) {
        console.log(`${name} is now ${capture(`npm view ${name} version`)}`);
    }

    console.log('Release published.');
}
```

Note that `gh run watch --exit-status` is what makes this script honest: without it,
the function returns successfully whether or not anything reached the registry.

## Important Notes

- Always use `pnpm run version` (not `pnpm version` — `version` is a pnpm built-in
  command, so the bare form silently does not run the package script)
- Changeset files must be committed with the code they describe
- Run the test suite before committing; CI will not do it for you on `main`
- Verify all git operations succeed before proceeding
- The release script automatically generates date-based tags
- GitHub Actions handles the actual npm publishing — asynchronously, and fallibly.
  A created release is not a completed publish; always confirm on the registry.
