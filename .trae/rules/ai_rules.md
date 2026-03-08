# AI Rules (Compact)

Stack: Next.js, React, TypeScript, MongoDB, NextAuth.

Architecture:
Feature-first, modular.

Folders:
@core → infrastructure
features/<feature> → business logic
shared → reusable UI

Pages: thin, compose components only
Features: own logic, use components/hooks/services/types
APIs: validate, auth, tenantId from session
Security: never trust tenantId from client, never hardcode secrets
