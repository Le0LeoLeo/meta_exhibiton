# Dependency Security Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use the local execution workflow to implement this plan task-by-task.

**Goal:** Remove known npm dependency vulnerabilities without introducing unrelated framework major upgrades.

**Architecture:** Upgrade the vulnerable direct dependencies to the smallest compatible safe releases, then let npm refresh vulnerable transitive packages within their declared ranges. Verify both production-only and full dependency audits before running the existing server, test, and production-build checks.

**Tech Stack:** npm, React Router 7, Vite 6, Socket.IO 4, Vitest.

---

### Task 1: Capture the security baseline

**Files:**
- Inspect: `package.json`
- Inspect: `package-lock.json`

1. Run `npm audit --omit=dev --json` and record the production vulnerability count.
2. Run `npm audit fix --dry-run --json` to inspect the complete remediation set.
3. Query npm registry versions for React Router, Vite, UUID, Socket.IO, `ws`, Engine.IO, `qs`, and `undici`.
4. Select React Router 7.18.1 and Vite 6.4.3 rather than framework major upgrades.

### Task 2: Apply minimal direct upgrades

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

1. Install `react-router@7.18.1`, `uuid@13.0.2`, and `vite@6.4.3`.
2. Run `npm audit fix` without `--force` to refresh vulnerable transitive packages within compatible ranges.
3. Confirm npm did not install React Router 8 or another framework major.

### Task 3: Verify the resolved dependency graph

1. Run `npm ls react-router vite uuid socket.io socket.io-client ws engine.io engine.io-client socket.io-adapter qs undici --depth=3`.
2. Run `npm audit --omit=dev` and require zero production vulnerabilities.
3. Run `npm audit` and require zero full-tree vulnerabilities, or document any advisory with no compatible fix.

### Task 4: Regression validation

1. Run `npm run check`.
2. Require server syntax, all Vitest tests, and production build to pass.
3. Run `git diff --check -- package.json package-lock.json`.
4. Review the scoped dependency diff and leave unrelated worktree changes untouched.

