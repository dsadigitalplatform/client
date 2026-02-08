
# Project Rules: Folder Structure, Architecture, and AI Development

This project follows a **feature-first, multi-tenant architecture** using **Next.js App Router**.  
A **strict separation** is enforced between routing, features, and shared UI.  
Pages are **thin composition layers only**. All UI, logic, and data access live outside `app/`.

These rules are **mandatory** for all contributors and AI agents (including Trae).

---

## 1. App Router Rules

### Route Groups

#### `app/(public)`
- Public routes only (e.g., login, signup)
- No authentication or tenant assumptions
- Uses `BlankLayout` via providers

#### `app/(protected)`
- Authenticated and tenant-protected routes only
- Uses a single protected layout (`layout.tsx`) for:
  - Authentication guard
  - Tenant resolution
  - Global navigation shell
- Pages must remain **thin**

#### `app/api`
- Server-only API routes grouped by domain (e.g., customers, users)
- API routes must **never trust client-provided tenant identifiers**

#### `middleware.ts`
- Centralized auth and tenant gating
- Redirects and access checks only
- ❌ No business logic
- ❌ No database access

---

## 2. Feature Modules (Core Rule)

All business functionality lives in **feature modules**.

### Location
```
src/features/<feature>
```

### Required Structure
```
components/        # UI only (presentation + event wiring)
hooks/             # Feature logic and state
services/          # API calls, adapters, mappers
<feature>.types.ts
index.ts           # Public barrel exports
```

### Feature Rules
- Features must **not import from `app/`**
- Features may import from `shared/`
- Features own their domain logic end-to-end
- Features must not depend on other feature internals

---

## 3. Page Rules (Strict)

- Page files must:
  - Be **thin**
  - Contain **no business logic**
  - Contain **no data fetching**
- Page files may:
  - Import and compose feature components
- Page files must not:
  - Define reusable UI
  - Call APIs directly
  - Contain stateful logic

Pages are **routing glue only**.

---

## 4. Naming Conventions

- Components: `PascalCase.tsx`  
  Example: `CustomersList.tsx`, `CustomerCreateForm.tsx`

- Hooks: `useX.ts`  
  Example: `useCustomers.ts`, `useCreateCustomer.ts`

- Services:
  - `<feature>Service.ts`
  - `<feature>Api.ts` (fetch-only allowed)

- Types:
  - `<feature>.types.ts`

- Barrels:
  - `index.ts` (mandatory per feature)

---

## 5. Imports and Aliases

- Always use **absolute imports via aliases**
- Never use deep relative imports (`../../..`)

### Approved Aliases
```
@features/*
@shared/*
@core/*
@layouts/*
@components/*
@configs/*
@assets/*
```

❌ Do not import from:
- `app/` (outside routing)
- Legacy or theme-specific folders

---

## 6. UI, Styling, and Theme Rules (Materio Replacement)

⚠️ **Materio theme components and styles must NOT be used.**

- Do not import Materio components, helpers, providers, or styles
- No Materio-specific class names, tokens, or utilities
- Use **only duplicated or custom components**

### UI Placement Rules
- Feature-specific UI → `features/<feature>/components`
- Reusable UI → `shared/components`
- Components must be theme-agnostic

---

## 7. Mobile-First Design (Mandatory)

- All pages and components must be designed **mobile-first**:
  - Default styles target small screens first; scale up at breakpoints
  - Use responsive props and breakpoints (e.g., MUI `sx`, `theme.breakpoints`)
  - Prefer fluid layouts with flex/grid and wrapping over fixed widths
  - Images and tables must be responsive and accessible
- Validate layouts at common breakpoints: `xs`, `sm`, `md`, `lg`, `xl`
- Avoid hidden functionality on mobile; feature parity is required
- Performance budgets must consider low-end mobile devices

---

## 8. Shared UI and Utilities

### Location
```
src/shared/
```

Use for:
- Generic UI components (Button, Input, Table)
- Reusable hooks
- Utilities
- Cross-feature types

Rules:
- No business logic
- No tenant assumptions
- Must be reusable across multiple features

---

## 9. Multi-Tenancy Rules (Critical)

- Tenant context is resolved in:
  - `middleware.ts`
  - `app/(protected)/layout.tsx`

### Tenant Enforcement
- Client code:
  - ❌ Must NOT send `tenantId`
- Server/API code:
  - ✅ Must derive tenant from session/token
  - ✅ Must scope all queries by tenantId

Tenant isolation is enforced **server-side only**.

---

## 10. Server vs Client Boundaries

- `app/api` routes are server-only
- Client services:
  - Must not contain secrets
  - Must not enforce tenant or auth rules
- Business enforcement happens **only on the server**

Use:
- API routes → validation and enforcement
- Services → communication layer
- Hooks → orchestration and state

---

## 11. State Management Rules

- Feature-level state lives in:
  - Feature hooks (`useX`)
- Avoid global state unless:
  - Truly cross-feature (e.g., auth, tenant)
- Prefer:
  - Local state
  - Feature hooks
  - Context only when required

---

## 12. API Guidelines

- API routes grouped by domain:
  ```
  app/api/<domain>/route.ts
  ```
- Always:
  - Validate inputs
  - Return typed JSON
  - Enforce auth and tenant scope
- Client code must access APIs **only via feature services**

---

## 13. Testing Rules

- Tests live close to features:
  ```
  src/features/<feature>/__tests__/
  ```
- Focus on:
  - Hooks
  - Services
- Pages:
  - Smoke tests only
  - No deep logic testing

---

## 14. AI Agent (Trae) Guardrails

When generating code, AI must:
- Follow this structure exactly
- Never introduce:
  - New architectural patterns
  - Theme-specific components
  - Business logic in pages
- Always:
  - Place logic in hooks/services
  - Place UI in feature/shared components
  - Keep pages thin

If unsure, **default to feature-based placement**.

---

## 15. CI Hygiene

Before pushing code:
- Run `npm run lint`
- Run `npm run build`
- Fix all errors and warnings
- No broken imports or unused exports

---

## 16. Reference Example

```tsx
// app/(protected)/customers/page.tsx
import { CustomersList } from '@features/customers'

export default function Page() {
  return <CustomersList />
}
```
