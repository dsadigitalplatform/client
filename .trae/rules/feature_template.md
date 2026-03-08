---
alwaysApply: false
---
# Feature Module Template

Create a feature using the project architecture rules.

Feature folder:
src/features/<feature>

Structure:
src/features/<feature>/
  components/
  hooks/
  services/
  <feature>.types.ts
  index.ts

Rules:
- Business logic goes in services.
- UI components go in components.
- State and orchestration go in hooks.
- Types defined in <feature>.types.ts.
- Do not place logic in pages.
- Do not access database from pages.
- API calls must go through services.

Service responsibilities:
- Call API routes
- Handle data transformation
- No UI logic

Hook responsibilities:
- Manage state
- Call services
- Provide data to components

Component responsibilities:
- Presentation only
- Receive data via props or hooks

Export pattern:
Use index.ts as barrel export.

Follow feature-first architecture.
