# AI Agent Guide: Changeset Process

This guide provides programmatic approaches for AI agents to handle the changeset workflow without interactive prompts.

## Overview

The standard `pnpm changeset` command is interactive and unsuitable for AI agents. This document outlines non-interactive alternatives.

## Programmatic Changeset Creation

### Method 1: Direct File Creation (Recommended)

Create changeset files directly since they're just markdown with frontmatter:

```javascript
const fs = require("fs");
const path = require("path");

function createChangeset(summary, releases) {
    const frontmatter = releases
        .map((r) => `"${r.name}": ${r.type}`)
        .join("\n");

    const content = `---
${frontmatter}
---

${summary}`;

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const filename = `${timestamp}-${random}.md`;
    const filepath = path.join(process.cwd(), ".changeset", filename);

    fs.writeFileSync(filepath, content);
    return filename;
}

// Usage:
createChangeset("Added new feature", [
    { name: "@sitchco/cli", type: "minor" },
    { name: "@sitchco/formatter", type: "patch" },
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
git diff --cached  # Review staged changes
```

### Step 2: Create Changeset

```javascript
// Determine affected packages and bump types
// Use the createChangeset function above
```

### Step 3: Stage and Commit

```bash
git add .changeset/[filename].md
git commit -m "feat: descriptive message"
```

### Step 4: Push Changes

```bash
git push origin main
```

### Step 5: Version Packages

```bash
pnpm run version  # NOT pnpm version
```

### Step 6: Commit Version Changes

```bash
git add .
git commit -m "Version Packages"
```

### Step 7: Push Version Changes

```bash
git push origin main
```

### Step 8: Create Release

```bash
pnpm release  # Creates date-based tag and GitHub release
```

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

- Verify changeset file was created
- Confirm git operations succeeded
- Check that `pnpm run version` completed successfully

## Integration with Existing Workflow

The programmatic approach maintains full compatibility:

- Changesets are consumed by `pnpm run version`
- Changelog generation works automatically
- Publishing workflow remains unchanged
- CI/CD validation continues to work

## Example Complete Script

```javascript
async function createRelease(packageChanges, description) {
    try {
        // Step 1: Create changeset
        const filename = createChangeset(description, packageChanges);
        console.log(`✅ Created changeset: ${filename}`);

        // Step 2: Stage changeset
        execSync(`git add .changeset/${filename}`, { stdio: "inherit" });

        // Step 3: Commit
        execSync('git commit -m "feat: ' + description + '"', {
            stdio: "inherit",
        });

        // Step 4: Push
        execSync("git push origin main", { stdio: "inherit" });

        // Step 5: Version
        execSync("pnpm run version", { stdio: "inherit" });

        // Step 6: Commit version changes
        execSync('git add . && git commit -m "Version Packages"', {
            stdio: "inherit",
        });

        // Step 7: Push version changes
        execSync("git push origin main", { stdio: "inherit" });

        // Step 8: Create release
        execSync("pnpm release", { stdio: "inherit" });

        console.log("🎉 Release completed successfully!");
    } catch (error) {
        console.error("❌ Release failed:", error.message);
        throw error;
    }
}
```

## Important Notes

- Always use `pnpm run version` (not `pnpm version`)
- Changeset files must be committed with the code they describe
- Verify all git operations succeed before proceeding
- The release script automatically generates date-based tags
- GitHub Actions will handle the actual npm publishing
