# Pull request checklist

Please fill in the checklist before requesting review. AI-generated changes must include a human reviewer assignment.

- [ ] Branch from `main` with a descriptive name
- [ ] `npm run format` completed
- [ ] `npm test` passed locally
- [ ] `docs/STATUS.md` updated if code/tests/coverage changed
- [ ] Add reviewer and assign at least one human reviewer
- [ ] Mark the PR with `ai:generated` label if the change was produced or heavily assisted by an AI

Notes: If the change touches `src/vendor/`, run `npm run vendor:verify` locally and include the verification output in the PR description.
