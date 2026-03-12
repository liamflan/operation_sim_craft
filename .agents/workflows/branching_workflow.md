---
description: How to manage phase-based branching
---

This workflow governs how new phases or sections are managed in the `operation_sim_craft` repository.

### Workflow Steps

1. **Before starting a new phase:**
   - Identify that a new logical section or phase of work is beginning.
   - Run `git branch` to check current branch.
   - Run `git status` to ensure working tree is clean on `main`.
   - Create a new branch from `main`: `git checkout -b phase-[number]-[description]`.

2. **During the phase:**
   - All commits and feature work happen on the phase branch.
   - Update `task.md` and `implementation_plan.md` as usual.

3. **Upon completion and sign-off:**
   - Ensure the user has formally signed off on the work (usually via `walkthrough.md` review).
   - Checkout `main`: `git checkout main`.
   - Pull latest: `git pull origin main`.
   - Merge the phase branch: `git merge phase-[number]-[description]`.
   - Push to `main`: `git push origin main`.
   - Delete the local and remote phase branch: `git branch -d phase-[number]-[description]`.

### Branch Naming Convention
- `phase-[number]-[description]`
- Example: `phase-21-user-auth-fix`
- Example: `phase-22-onboarding-polish`
