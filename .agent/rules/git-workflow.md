---
trigger: always_on
---

# Git Workflow Rule

## Feature Branch Requirement
Before making any writes or changes to the codebase, check the current git branch.
- If the current branch is `main` (or `master`), you MUST create and switch to a new feature branch.
- Name the branch descriptively based on the task (e.g., `feature/add-new-widget`, `fix/login-bug`).
- Do NOT commit directly to `main`.

## End of Implementation Merge
At the end of an implementation cycle, if:
1. All tasks are completed.
2. The user has no new requests.
3. Tests are passing (if applicable).

Then you MUST prompt the user:
"Do you want to merge [current-branch] into main?"

If they agree, perform the merge and switch back to `main` (or the previous branch).
