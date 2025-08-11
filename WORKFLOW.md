## Project Workflow and Rules

This document defines how we execute work in this repository. It is concise by design and references our system specification in `SYSTEM-SPECIFICATIONS.md`.

### Guiding Principles
- **Single small task flow**: Work on one small, independently verifiable task at a time.
- **Definition of Done**: Code + tests + docs + lint/build green + acceptance criteria met.
- **Local-first**: Changes should keep the app usable offline and safe to roll back.

### Task Lifecycle
1. Propose/clarify the task in `TODOs.md` with:
   - Description (1–2 sentences)
   - Acceptance criteria (bullet list)
   - Verification steps (few commands or manual checks)
2. Create a branch: `feature/<short-id>-<slug>` or `fix/<short-id>-<slug>`.
3. Implement the smallest slice that meets the acceptance criteria.
4. Update `TODOs.md` status and any relevant docs.
5. Open a PR referencing the TODO item. Ensure all checks pass.
6. Review focused on correctness, clarity, and performance budgets.
7. Merge via squash. Delete branch.

### Branch, Commit, PR
- Branch protection on `main`; PR required to merge.
- Commits follow Conventional Commits, e.g. `feat(core): add sqlite schema migration runner`.
- PR checklist:
  - Lint/test/build green
  - Acceptance criteria met
  - Updated docs if behavior/CLI/ API changed
  - No secrets or sample data checked in

### CI/CD and Quality Gates
- Required jobs: lint, unit tests, type checks, build (and minimal e2e where applicable).
- Performance guards where budgets exist; regressions must be called out.
 - For multi-service orchestration (web/api/db/storage), provide `docker-compose.yml` and healthchecks; CI should at least build containers.

### Docs and Specs
- Keep docs minimal and actionable.
- Structure: `category[/sub-category]/tool-name/README.md` plus supporting files.
- Reference: `SYSTEM-SPECIFICATIONS.md` for the system-level spec.
- Keep `TODOs.md` up to date after each completed task. Proceed strictly in milestone order unless a blocker is documented.
 - For new services (web/api), add `README.md` with local run commands and env requirements.

### Code, Style, and Safety
- Follow repository conventions (TypeScript/Python/SQL styles, logging, security, REST, testing).
- Secrets: never commit; use environment variables and `.env.example` with placeholders.
- Error handling: prefer explicit, typed errors with actionable messages.
- Add relevant inline documentation when code is polished

### Testing Policy
- Unit tests for core logic and merge rules.
- Integration tests for DB, sync, import/export.
- Golden files for analyzers.
- Keep tests fast and deterministic; mark long/perf tests separately.

### Definition of Done (DoD)
- Acceptance criteria satisfied and verified.
- Lint/type/build/tests green.
- Docs updated (README or `docs/` where relevant).
- No high-severity security findings; no PII or secrets.

### References
- System specification: `SYSTEM-SPECIFICATIONS.md`


