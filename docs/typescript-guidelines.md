# Using TypeScript in a Sitchco Package

This guide outlines the minimum steps to enable TypeScript in a package inside `sitchco-core/packages`. The goal is to allow the build system to compile `.ts` files into JavaScript so that the package can be deployed to NPM.

---

## Setting up a Package Using TypeScript

Below is a 101 level overview of how to setup a package to use TS. This isn't any different than a normal TS setup, but does provide the needed properties for proper configuration to support publishing to NPM.

---

### 1. Add TypeScript Dependencies

Inside the package that uses TypeScript (e.g., `packages/my-package/`), install TypeScript:

```bash
pnpm add -D typescript
```

This saves TypeScript as a dev dependency **local to the package**. It does not need to be added to the monorepo root.

---

### 2. Create a `tsconfig.json` in the Package

Inside your package directory, create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "lib": ["ES2020"],
    "outDir": "dist",
    "declaration": true,
    "esModuleInterop": true,
    "strict": true
  },
  "include": ["src"]
}
```

This will compile all `.ts` files from the `src/` directory into `dist/`.

---

### 3. Update `package.json`

Add the following fields and build script to your package’s `package.json`:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc"
  }
}
```

---

### 4. Write TypeScript Code

Create your TypeScript files inside a `src/` directory. For example:

`src/index.ts`:
```ts
export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
```

---

### 5. Build the Package

From the package directory, run:

```bash
pnpm build
```

This will compile the TypeScript files into `dist/`.

---

### 6. Verify Output

After build:
- `dist/index.js` — compiled JavaScript
- `dist/index.d.ts` — type declarations

These files will be included in your published package based on the `files` field in `package.json`.

---

### 7. Run the Monorepo Build

Once your TypeScript package is set up, you can run the full monorepo build from the project root:

```bash
pnpm -r run build
```

This command will invoke the build script defined in each package, regardless of whether it's using JavaScript or TypeScript. The build system does not need to know or care which language is used. As long as the package is properly configured (with tsc for TS or any other build tool for JS), it will compile and output as expected.

---

Your package is now TypeScript-enabled and ready for publishing to NPM.

## Guidelines for Choosing TypeScript vs JavaScript

These guidelines are simply meant to provide a point of view on when to prefer TypeScript over JavaScript. This is not a standard, nor a requirement.

---

### Use TypeScript when:

1. The package is a reusable library or utility
    * Examples: shared UI components, formatting helpers, config builders, client-side utilities.
    * Benefit: Consumers get autocompletion and compile-time safety.
2. You want stronger guarantees around contracts and structures
    * Helpful for APIs, plugin hooks, config schemas, etc.
3. The package has complex logic, multiple collaborators, or long-term maintenance expectations
    * TS reduces bugs in larger codebases and makes refactoring safer.
4. The package is intended to be published and consumed by other packages or themes
    * Consumers benefit from generated .d.ts files for type safety.

---

### Use JavaScript when:

1. The package is simple, short-lived, or script-like in nature
    * Examples: glue code, build wrappers, one-off scripts, or themes with minimal logic.
    * You’re prioritizing speed of iteration or prototyping
2. JS has lower setup overhead and is easier to write quickly.
    * The code will never be used outside its own context
    * For example, code that's tightly scoped to a single theme and not shared.
