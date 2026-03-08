---
alwaysApply: false
---
# AI Rules

Stack: Next.js (App Router), React, TypeScript, MongoDB, NextAuth.

Architecture:
Feature-first modular structure.

Folders:
src/@core → infrastructure (auth, db)
src/features/<feature> → business logic
src/shared → reusable components
app/(public) → public routes
app/(protected) → authenticated routes
app/api → API endpoints

Rules:
Pages must stay thin and only compose components.

No business logic or DB access in pages.

Features contain:
components / hooks / services / types.

APIs must:
validate input,
enforce authentication,
derive tenantId from session.

Security:
Never trust tenantId from client.
Never hardcode secrets.
Never modify Mongo schema.

If unsure:
core = infrastructure,
features = domain logic,
pages = composition only.
