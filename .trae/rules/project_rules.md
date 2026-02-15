# Project Rules: Folder Structure, Architecture, and AI Development

This project follows a **feature-first, multi-tenant architecture** using **Next.js App Router**.

A strict separation is enforced between routing, core systems, features, and shared UI.  
Pages are thin composition layers only.  
All UI, logic, and data access live outside `app/`.

These rules are mandatory for all contributors and AI agents.

---

# 1. App Router Rules

## Route Groups

### `app/(public)`
- Public routes only (e.g., login, signup)
- No authentication or tenant assumptions
- Uses `BlankLayout` via providers

### `app/(protected)`
- Authenticated and tenant-protected routes only
- Uses a single protected layout (`layout.tsx`) for:
  - Authentication guard
  - Tenant resolution
  - Global navigation shell
- Pages must remain thin

### `app/api`
- Server-only API routes grouped by domain
- Must validate input
- Must enforce authentication
- Must enforce tenant isolation
- Must never trust client-provided tenant identifiers
- Must not contain business logic

### `middleware.ts`
- Redirect logic only
- May check presence of session
- Must not access database
- Must not resolve memberships
- Must not contain business logic

---

# 2. Core System Layer (Critical)

Core infrastructure lives under:

```
src/@core/
```

Core includes:
- Authentication
- Database connection
- Session helpers
- Guards and enforcement utilities

Core is not a feature.

---

# 3. Authentication Architecture (Mandatory)

Authentication is a core cross-application system.

## Required Folder Structure

```
src/@core/
  auth/
    authOptions.ts
    session.ts
    guards.ts
    types.ts
    index.ts
  db/
    mongodb.ts

src/features/auth/
  components/
  hooks/
  services/
  index.ts

app/api/auth/[...nextauth]/route.ts
```

## Auth Placement Rules

- Auth logic must not live inside business features
- No database logic inside `app/api`
- No session mutation inside pages
- Auth config must live in `@core/auth`
- Mongo connection must live in `@core/db/mongodb`

## Session Contract

JWT session must include:

```ts
{
  userId: string
  isSuperAdmin: boolean
  currentTenantId?: string
  impersonatingTenantId?: string
}
```

Rules:
- Session is server-trusted only
- Tenant must never be derived from client input
- Tenant must not be stored in localStorage
- Tenant switching must update JWT server-side

## Auth + Tenant Flow

1. User authenticates
2. Memberships are checked
3. Tenant context is established
4. Protected routes require valid session + tenant

## NextAuth Rules

- Use JWT session strategy
- Do not use database sessions
- On first Google login:
  - Create user in `users`
  - Create authAccount in `authAccounts`
- On login:
  - Update `lastLoginAt`
- Do not modify MongoDB schema
- Do not create new collections

## Environment Variables

Must use:

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
MONGODB_URI
```

Secrets must never be hardcoded.

---

# 4. Feature Modules

All business functionality lives in:

```
src/features/<feature>
```

## Required Structure

```
components/
hooks/
services/
<feature>.types.ts
index.ts
```

## Feature Rules

- Must not import from `app/`
- May import from `@shared/`
- Must not depend on other feature internals
- Own domain logic end-to-end

---

# 5. Page Rules

Pages must:
- Be thin
- Contain no business logic
- Contain no data fetching
- Only compose feature components

Pages must not:
- Call APIs directly
- Access database
- Define reusable UI
- Mutate session

---

# 6. Naming Conventions

Components: PascalCase.tsx  
Hooks: useX.ts  
Services: `<feature>Service.ts`  
Types: `<feature>.types.ts`  
Barrels: `index.ts` (mandatory)

---

# 7. Imports and Aliases

Always use absolute imports.

Approved aliases:

```
@features/*
@shared/*
@core/*
@layouts/*
@components/*
@configs/*
@assets/*
```

No deep relative imports.  
Do not import from `app/` outside routing.

---

# 8. UI and Theme Rules

Materio theme components must not be used.

- No Materio providers
- No Materio tokens
- No Materio utilities

Feature UI → `features/<feature>/components`  
Shared UI → `shared/components`

Components must be theme-agnostic.

---

# 9. Mobile-First Design

- Design mobile-first
- Use responsive breakpoints (`xs`, `sm`, `md`, `lg`, `xl`)
- No hidden mobile functionality
- Layouts must scale progressively
- Optimize for low-end mobile performance

---

# 10. Multi-Tenancy Rules

Tenant context resolved in:

```
app/(protected)/layout.tsx
```

Middleware may redirect but not resolve memberships.

## Tenant Enforcement

Client:
- Must not send tenantId

Server:
- Must derive tenantId from session
- Must scope all queries by tenantId
- Must validate membership status

Tenant isolation is enforced server-side only.

---

# 11. Server vs Client Boundaries

API routes:
- Validation
- Enforcement
- Tenant scoping

Client services:
- No secrets
- No enforcement

Hooks:
- Orchestration and state

---

# 12. State Management

- Feature state in feature hooks
- Avoid unnecessary global state
- Auth and tenant context may use controlled global context

---

# 13. API Guidelines

Routes grouped by domain:

```
app/api/<domain>/route.ts
```

Always:
- Validate input
- Enforce auth
- Enforce tenant
- Return typed JSON

Client must access APIs through feature services.

---

# 14. Testing Rules

Tests live near features:

```
src/features/<feature>/__tests__/
```

Focus on:
- Hooks
- Services

Pages:
- Smoke tests only

---

# 15. AI Agent Guardrails

AI must:
- Follow this structure strictly
- Never place logic in pages
- Never access DB from pages
- Never modify Mongo schema
- Never bypass tenant enforcement
- Never hardcode secrets

If unsure:
- Default to core for infrastructure
- Default to features for business logic
- Keep pages thin

---

# 16. CI Hygiene

Before pushing:
- Run lint
- Run build
- Fix all errors
- No broken imports
- No unused exports

---

# Final Architecture Principles

- Users ≠ Tenants  
- Membership is the bridge  
- Authentication precedes tenant resolution  
- Tenant context is mandatory  
- Super admin never bypasses security  
- All data is tenant-scoped  
- Pages are thin  
- Core handles infrastructure  
- Features handle business logic  
