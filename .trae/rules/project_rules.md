# Project Rules: Folder Structure and Component Placement

Adopt a strict separation between Next.js routes and feature modules. Pages are thin; all UI and logic live in features. Use the path aliases set in tsconfig for imports.

## App Router
- app/(public): Public routes only (e.g., login, signup). Uses BlankLayout via Providers.
- app/(protected): Auth/tenant-protected routes. Contains thin pages that compose feature components only. Uses the protected layout.
- app/api: Server API routes grouped by domain (e.g., customers, auth).
- middleware.ts: Central place for auth/tenant gating. Avoid per-page guards inside UI components.

## Feature Modules
- Location: src/features/<feature>
- Structure:
  - components/: UI components for the feature (presentation and event wiring only)
  - hooks/: Client hooks that contain feature logic and state
  - services/: Data access (fetch calls, adapters), no secrets in client code
  - <feature>.types.ts: Shared types for the feature
  - index.ts: Barrel exports for public API of the feature

## Page Rules
- Page files must be thin and contain no business logic.
- Page files must import and render feature components only.
- Place pages under app/(public) or app/(protected) according to access level.
- Do not place reusable UI inside app/; keep it in features or shared.

## Naming Conventions
- Components: PascalCase, .tsx (e.g., CustomersList.tsx, DashboardHome.tsx)
- Hooks: useX.ts (e.g., useCustomers.ts)
- Services: <feature>Service.ts (e.g., customersService.ts)
- Types: <feature>.types.ts (e.g., customers.types.ts)
- Barrels: index.ts per feature

## Imports and Aliases
- Use aliases: @features/*, @shared/*, @core/*, @layouts/*, @menu/*, @components/*, @configs/*, @views/*
- Avoid deep relative imports (../../..). Prefer aliased absolute imports.

## Example: Customers Feature
- Feature:
  - src/features/customers/components/CustomersList.tsx
  - src/features/customers/hooks/useCustomers.ts
  - src/features/customers/services/customersService.ts
  - src/features/customers/customers.types.ts
  - src/features/customers/index.ts
- Page:
  - app/(protected)/customers/page.tsx
  - app/(protected)/customers/create/page.tsx
- API:
  - app/api/customers/route.ts

## Example Thin Page
```tsx
// app/(protected)/customers/page.tsx
import { CustomersList } from '@features/customers'

export default function Page() {
  return <CustomersList />
}
```

## Layout Usage
- Public pages use BlankLayout via app/(public)/layout.tsx.
- Protected pages use the existing protected LayoutWrapper (navigation, headers, footers) via app/(protected)/layout.tsx.

## Shared UI
- Reusable UI or utilities that are not tied to a single feature live in src/shared.
- Keep shared components generic and style-agnostic where possible.

## API Guidelines
- Group API routes under app/api/<domain>.
- Validate inputs on the server; return typed JSON responses consumed by services in features.

## Testing
- Place unit tests close to the feature (e.g., src/features/<feature>/__tests__).
- Prefer testing hooks/services in isolation; pages should be smoke-tested only.

## CI Hygiene
- After changes:
  - Run `npm run lint`
  - Run `npm run build`
  - Address any errors before pushing
