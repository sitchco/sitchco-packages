# Using Husky in This Monorepo

This monorepo uses [Husky](https://typicode.github.io/husky) to run Git hooks — like `pre-commit` — to ensure code quality and consistency before changes are committed.

Husky is **installed and configured only at the root of the monorepo**. Each package inside the repo can **independently opt in** to participate in Git hooks (e.g., to run linting, formatting, or tests) by creating a special hook file.

---

## How Husky Works Here

- Husky is **installed once** at the root
- The root `.husky/pre-commit` hook runs during every Git commit
- It searches all workspace packages under `packages/*/*`
- If a package contains a `.husky/pre-commit-local` file, that script will be run

This setup gives each package full control over whether and how it participates in commit validation.

---

## How to Opt In (Per Package)

If a package wants to run something on every commit (e.g. `eslint`, `prettier`, `tests`), follow these steps:

### 1. Create a Local Pre-Commit Hook

Inside your package folder (e.g. `packages/tools/module-builder`), create:

.husky/pre-commit-local

Make sure it's executable:

```bash
chmod +x .husky/pre-commit-local
```

### 2. Add Your Lint/Test Command

Example .husky/pre-commit-local:

```bash
#!/bin/sh
echo "[module-builder] Running pre-commit tasks..."
pnpm lint
```

You can run any shell commands here (lint, tests, format, etc.).

---

## How It All Connects

The root hook (.husky/pre-commit) looks like this:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running per-package pre-commit hooks..."

repo_root=$(git rev-parse --show-toplevel)

# Loop over all nested packages matching packages/*/*
for pkg_path in "$repo_root"/packages/*/*; do
  if [ -d "$pkg_path" ]; then
    pkg_hook="$pkg_path/.husky/pre-commit-local"

    if [ -x "$pkg_hook" ]; then
      echo "Running $pkg_hook"
      (cd "$pkg_path" && "$pkg_hook")
    fi
  fi
done
```

This ensures all relevant packages get a chance to validate their code, without enforcing a centralized script.

---

## Testing Implementations

You can test the hook without modifying files by doing:

```bash
git commit --allow-empty -m "Test husky"
```

If your package has a .husky/pre-commit-local file, it should run and show output.
