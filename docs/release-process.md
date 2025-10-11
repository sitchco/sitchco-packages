# Release Process

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. The workflow is split into two phases: documenting changes during development, and publishing releases when ready.

## Phase 1: During Development (Per Feature/Fix)

**Every time you make a user-facing change**, create a changeset to document it:

```bash
# 1. Make your code changes

# 2. Create a changeset describing the changes
pnpm changeset
```

You'll be prompted to:
- Select which packages changed
- Choose the bump type:
  - `patch` - Bug fixes, internal refactors, dependency updates
  - `minor` - New features (backward compatible)
  - `major` - Breaking changes
- Write a clear description of the change

```bash
# 3. Commit the changeset WITH your code changes
git add .
git commit -m "feat: your feature description"
git push
```

**Important:** Changeset files (`.changeset/*.md`) should be committed alongside the code they describe. This creates a traceable history of what changed and why.

## Phase 2: Creating a Release

When you're ready to publish a new version:

### 1. Ensure All Changes Are Merged

```bash
git checkout main
git pull origin main
```

### 2. Version the Packages

Run the version script to consume all pending changesets:

```bash
pnpm version
```

This runs `pnpm changeset version`, which:
- Deletes all `.changeset/*.md` files
- Updates package.json versions based on changeset bump types
- Generates/updates CHANGELOG.md files with changeset descriptions
- Updates internal dependencies
- Updates pnpm-lock.yaml

### 3. Commit and Push Version Changes

```bash
git add .
git commit -m "Version Packages"
git push origin main
```

### 4. Create a GitHub Release

Create a GitHub release to trigger the publish workflow:

```bash
# Using GitHub CLI (recommended)
gh release create v2.0.22 --generate-notes

# Or manually via GitHub UI:
# 1. Go to Releases → Draft a new release
# 2. Create a new tag (e.g., v2.0.22)
# 3. Use "Generate release notes" button
# 4. Publish release
```

The GitHub Action (`.github/workflows/publish-packages.yml`) will automatically:
- Install dependencies
- Build packages
- Run `pnpm changeset publish` to publish to npm

## Quick Reference

```bash
# During development (per PR/feature)
pnpm changeset              # Create changeset
git add .changeset/*.md     # Stage changeset
git commit -m "feat: ..."   # Commit with code

# When releasing
pnpm version                # Version packages
git add .                   # Stage version changes
git commit -m "Version Packages"
git push
gh release create v2.0.22 --generate-notes  # Publish
```

## Common Mistakes to Avoid

❌ **Don't** run `pnpm changeset` at release time - do it during development
❌ **Don't** manually edit CHANGELOG.md files - let changesets generate them
❌ **Don't** run `pnpm changeset version` without any changesets - this creates empty changelog entries
✅ **Do** create changesets for every user-facing change
✅ **Do** commit changesets with their related code changes
✅ **Do** write clear, user-focused changeset descriptions
