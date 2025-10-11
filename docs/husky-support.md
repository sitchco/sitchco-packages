# Git Hooks with Husky

The `@sitchco/cli` package provides integrated Git hooks via [Husky](https://typicode.github.io/husky) to ensure code quality and consistency before changes are committed.

This document covers:
- [Using Husky in Your Project](#using-husky-in-your-project) - For consumers of `@sitchco/cli`
- [Using Husky in This Monorepo](#using-husky-in-this-monorepo) - For contributors to this repo
- [Advanced: Per-Package Hooks](#advanced-per-package-hooks) - Future enhancement pattern

---

## Using Husky in Your Project

If you're using `@sitchco/cli` in your own repository, you can enable automatic formatting and linting on commit.

### Installation

1. **Install the CLI** (if not already installed):
   ```bash
   npm install --save-dev @sitchco/cli husky
   # or
   pnpm add -D @sitchco/cli husky
   ```

2. **Add the prepare script** to your `package.json`:
   ```json
   {
     "scripts": {
       "prepare": "sitchco prepare"
     }
   }
   ```

3. **Run the installation**:
   ```bash
   npm install
   # or
   pnpm install
   ```

This will:
- Install Husky hooks in your `.husky` directory
- Create a `.husky/pre-commit` hook that runs `sitchco pre-commit`

### What the Hook Does

When you commit changes, the pre-commit hook automatically:

1. **Formats** all staged files using Prettier (with PHP support)
2. **Re-stages** the formatted files
3. **Lints** your code with ESLint
4. **Blocks the commit** if linting fails

### Skipping Hooks

To skip pre-commit checks (e.g., for WIP commits):

```bash
git commit --no-verify -m "WIP: work in progress"
```

**Warning:** Use sparingly - bypasses all quality checks.

---

## Using Husky in This Monorepo

For developers working on the `sitchco-packages` monorepo itself.

### Setup

Husky is installed and configured automatically when you run:

```bash
pnpm install
```

This triggers the `prepare` script which runs `sitchco prepare` to install the Git hooks.

### Manual Reinstallation

If you need to reinstall hooks manually:

```bash
pnpm run prepare
```

Or directly:

```bash
sitchco prepare
```

---

## The Pre-Commit Hook

The `.husky/pre-commit` hook contains:

```bash
#!/bin/sh

set -e
if [ -d "node_modules" ]; then
    sitchco pre-commit
else
    npx @sitchco/cli pre-commit
fi
```

This ensures the hook works whether you have `sitchco` installed locally or need to use `npx`.

---

## What Happens During a Commit

1. You run `git commit`
2. Husky intercepts and runs `.husky/pre-commit`
3. The hook executes `sitchco pre-commit`, which:
   - Checks for staged files
   - Formats them with Prettier
   - Re-stages the formatted files
   - Runs ESLint on the workspace
   - Blocks the commit if linting fails

---

## Skipping Hooks (Not Recommended)

If you need to skip pre-commit checks (e.g., for WIP commits), use:

```bash
git commit --no-verify -m "WIP: work in progress"
```

**Warning:** This bypasses all quality checks. Use sparingly and fix issues before merging.

---

## Troubleshooting

### Hook Not Running

If the pre-commit hook isn't executing:

```bash
# Reinstall hooks
pnpm run prepare

# Check hook exists and is executable
ls -la .husky/pre-commit
```

### Hook Fails

If the pre-commit check fails:

1. **Formatting issues**: The hook auto-formats, so this shouldn't happen
2. **Linting errors**: Fix the ESLint errors shown in the output
3. **Missing dependencies**: Run `pnpm install`

### Performance

If pre-commit checks are slow:
- The formatter only processes staged files (fast)
- The linter runs on the whole workspace (can be slow for large projects)
- Consider running `pnpm lint` before committing to catch issues early

---

## Advanced: Per-Package Hooks

**Note:** This is a future enhancement pattern, not currently implemented.

If you need individual packages to run custom pre-commit checks (e.g., package-specific tests), you can implement a per-package hook system.

### Implementation Pattern

1. **Modify `.husky/pre-commit`** to search for and execute package-level hooks:

   ```bash
   #!/bin/sh

   set -e

   # Run the standard sitchco pre-commit
   if [ -d "node_modules" ]; then
       sitchco pre-commit
   else
       npx @sitchco/cli pre-commit
   fi

   # Run per-package hooks if they exist
   echo "Checking for package-specific hooks..."
   repo_root=$(git rev-parse --show-toplevel)

   for pkg_path in "$repo_root"/packages/*/*; do
     if [ -d "$pkg_path" ]; then
       pkg_hook="$pkg_path/.husky/pre-commit-local"

       if [ -x "$pkg_hook" ]; then
         echo "Running hook for $(basename $pkg_path)..."
         (cd "$pkg_path" && "$pkg_hook")
       fi
     fi
   done
   ```

2. **Create package-specific hooks** in any package that needs custom checks:

   ```bash
   # packages/tools/module-builder/.husky/pre-commit-local
   #!/bin/sh

   echo "[module-builder] Running package tests..."
   pnpm test
   ```

   Make it executable:
   ```bash
   chmod +x packages/tools/module-builder/.husky/pre-commit-local
   ```

### Use Cases

This pattern is useful for:
- **Package-specific tests** that shouldn't run for the whole workspace
- **Custom validation** for packages with special requirements
- **Performance optimization** by only running expensive checks when specific packages change

### Considerations

- **Maintenance overhead**: More hooks = more complexity
- **Performance**: Each package hook adds time to commits
- **Consistency**: Global checks (format/lint) should stay centralized
- **Documentation**: Each package hook should be well-documented

Only implement this if the standard workspace-wide checks aren't sufficient for your needs.
