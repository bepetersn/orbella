# AI Guidelines — Worldle Lite

This document is the canonical, short-form guide for using AI assistants with the Worldle Lite repository.
Link from `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` to keep a single source of truth.

IMPORTANT: create a git worktree before editing

Before making any file changes in this repository, create an isolated `git worktree` branch and perform edits there. Do not edit files directly in the main working tree. Using a worktree keeps AI-driven changes isolated, makes commits and reviews traceable, and prevents accidental changes to the primary working copy.

Example (see the detailed `Local agent workflow` below):

```bash
git fetch origin
git worktree add ../wt-agent -b ai/agent-<id>-<topic> main
cd ../wt-agent
```

Follow the Local agent workflow later in this document for the full example and commit conventions.

IMPORTANT: create a `git worktree` before editing files

Before making any changes to files in this repository, create a local git worktree and work inside that branch. This keeps your edits isolated from the main working tree and makes commits and reviews traceable. Example:

```bash
git fetch origin
git worktree add ../wt-agent -b ai/agent-<id>-<topic> main
cd ../wt-agent
```

All further instructions in this document assume you are working inside a worktree branch. Do not edit files directly in the primary working directory.

## Purpose

- Explain permitted AI roles and responsibilities for this project.
- Surface non-negotiable guardrails that prevent common, risky changes.
- Provide a contributor workflow, verification checklist, and prompt templates.

## Scope & Roles

- Allowed: generate code changes, tests, documentation edits, small refactors, and focused bugfixes when the author verifies results.
- Assisted: propose larger architectural changes as PRs or drafts; do not merge without human review.
- Not allowed: impersonate maintainers, commit secrets, or make broad changes to load-bearing import order / runtime globals.

## Non-negotiable Guardrails

- Do not add `window._gameStore` reads or writes anywhere.
- Do not reorder, add, or remove imports in `src/main.js` (import order is load-bearing).
- Do not replicate `window.worldleLiteRuntime` patterns; use `buildRuntime()` fixture in tests.
- Always run `npm run format` and `npm test` locally after changes.

Rationale: these patterns are documented tech-debt and changing them without a coordinated refactor breaks many tests and runtime assumptions.

## Contributor Workflow (AI + Human)

1. Create a `git worktree` from `main` and work inside it (see example above). This must be done before modifying any files in the repository.
2. Run `npm run format` and `npm test` locally; fix issues until green.
3. Update `docs/STATUS.md` as required (Recent Work, counts, last updated).
4. Open a PR and request a human review. AI-originated PRs must include a reviewer assignment and the checklist below.

## Pre-merge Verification Checklist (required)

- `npm run format` completed.
- `npm test` passed locally (and CI green).
- `npm run vendor:verify` ran if `src/vendor/` changed.
- `docs/STATUS.md` updated for any code/test/coverage changes.
- A human reviewer approved the PR.

## Secrets & Data Policy

- Never include secrets, tokens, or sensitive files in prompts or commits.
- Redact or synthesize inputs when sharing snippets with an external AI service.
- Run a grep-based scan or `git-secrets` before committing if the change touched config or CI.

## Prompt Templates (examples)

- Bugfix: "In this repo, fix the failing test `tests/unit/foo.test.js`. Constraints: do not modify `src/main.js` imports or add `window._gameStore`. Run `npm test` locally after changes." 
- Add unit test: "Create a Vitest unit test for `src/map/utils.js` covering `lonLatTo3D`. Use `buildRuntime()` only for modules that read `window.worldleLiteRuntime`. Aim for >80% function coverage." 
- Docs update: "Add a short `docs/` file describing X and update `docs/STATUS.md` Recent Work with one sentence. Run `npm run format`."

### Which prompts are valuable

- Bug fixes: precise failing test or error message, file paths, and constraints (e.g., do not change `src/main.js` import order).
- Small feature or helper: describe the minimal API, expected inputs/outputs, and where it should live.
- Tests: request unit tests (Vitest) with fixtures and how to stub `window.worldleLiteRuntime` when needed.
- Refactors: small, well-scoped refactors (single-file or limited cross-file changes) with a required test-signal that behavior is unchanged.
- Documentation: README updates, docs/ files, and status updates — low-risk and high-value for automation.
- CI and automation: add or modify CI steps only when the change is narrowly scoped and the author will run the pipeline locally.
- Security and secrets audits: ask for a checklist or grep-based scan recommendations; never share secrets in prompts.

### Good vs Bad prompt examples

- Good: "Create a Vitest unit test for `src/store/lookup.js#findByName` that covers exact-match, alias-match, and case-insensitive fallback. Use the existing `tests/fixtures/mock-countries.js` fixture and `buildRuntime()` only where necessary. Do not change global runtime patterns." 
- Bad: "Write tests for the project" — too vague, no target function, no constraints, and risks broad changes.

Add these templates to the PR description when asking AI to generate code.

## CI Recommendations

- Ensure CI requires format-check and tests for merge.
- Add an optional bot-label or PR tag for AI-originated changes to draw reviewer attention.

## PR Template & Automation

- Use the repository PR template (see `.github/PULL_REQUEST_TEMPLATE.md`) which includes the required AI pre-merge checklist.
- Consider tagging AI-originated PRs with `ai:generated` label so reviewers can prioritise extra scrutiny.

## Git commits & AI

As part of your work, you must move toward making a git commit (or commits) when you are sure you have finished your work and there is completed work to commit. Keep commits smaller / discrete, as far as is possible.

Ask for clarification if it's not clear if you are finished. State the commit message that you will use. Ask if it's acceptable to commit.

Clear commit practice helps keep AI contributions auditable and reviewable. Follow these rules for any AI-assisted commits:

- Commit granularity: make small, focused, and atomic commits. Each commit should implement one logical change (e.g., "fix: add unit test for lonLatTo3D").
- Commit message format: start with a conventional prefix (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Include a short imperative summary and one-line reference to the verification steps run locally.
- AI provenance: if a commit was produced or substantially edited by an AI, include a trailer line in the commit body: `AI-Generated: true` and a short `AI-Notes:` section describing the prompt used or the files changed.
- Tests & formatting: do not commit code without running `npm run format` and `npm test` locally. Include the test result summary in the commit body if tests were re-run for the change.
- Docs/STATUS.md: when code or tests change, update `docs/STATUS.md` in the same branch/PR. Prefer one commit for code + tests and one commit for documentation if the doc change is sizable.
- Branching & PRs: branch from `main` using a descriptive name (e.g., `fix/map-centroid-test`) and open a PR that references the commit(s). Add `ai:generated` label when applicable.
- No secrets: never include secrets or sensitive data in commit messages or commit bodies.

Example commit message:

```
fix(store): correct fuzzy match scoring for leading whitespace

Ran: npm run format && npm test (all tests passed)

AI-Generated: true
AI-Notes: Prompt asked to fix `getBestFuzzyCountryMatch` edge-case; added trimming and test. Files changed: src/store/query.js, tests/unit/store/query.test.js
```

Rationale: these conventions make it easy for reviewers to spot AI-produced changes, reproduce verification steps, and understand intent.

## Local agent workflow (git worktree)

Use `git worktree` to keep your work isolated from the main working tree. This provides a simple, local branch-per-task workflow without cloning the repo.

Quick setup (example for one agent):

```bash
git fetch origin
git worktree add ../wt-agent -b ai/agent-<id>-<topic> main
cd ../wt-agent
# make changes, run format and tests, commit
npm run format && npm test
git add .
git commit -m "fix(map): tidy lonLat math\n\nRan: npm run format && npm test (all tests passed)\n\nAI-Generated: true\nAI-Notes: short prompt summary and files changed"
git push -u origin ai/agent-<id>-<topic>
```

Useful commands:
- `git worktree list` — list active worktrees
- `git worktree remove ../wt-agent` — remove a finished worktree
- `git worktree prune` — prune stale metadata
- `git worktree add ...`

Conventions:
- Branch naming: `ai/<agent-id>-<short-topic>` (e.g., `ai/agentA-fuzzy-match`).
- Keep commits small and focused; include `AI-Generated:` and `AI-Notes:` trailers (hooks help enforce this).

Once finished with all work in a particular area and a particular chat on a subject -- at the same time that a commit is being made--if no more work is forthcoming--, be ready and willing to merge your worktree back to the main / master branch, as your final action.