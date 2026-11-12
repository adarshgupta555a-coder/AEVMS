# Prompt: Generate the EMS Low-Level Design (LLD)

You are acting as a **Senior Software Architect, Product Analyst, Database Designer, and Technical Lead**. Your task is to create a complete, implementation-ready Low-Level Design (LLD) for my Event Management System (EMS).

## Inputs you must read

1. Read the complete `plan.md` first. It contains the confirmed product scope, current decisions, workflows, financial rules, constraints, and unresolved questions.
2. Inspect the actual project repositories and source files. The frontend and backend are separate projects/folders, not a monorepo.
3. Inspect at minimum:
   - Backend `package.json` and `tsconfig.json`.
   - `prisma7.config.js`.
   - `prisma/schema.prisma`.
   - Existing Prisma migrations.
   - Existing generated-client configuration and imports.
   - Existing backend source files and frontend route/component structure.
   - `.env.example` only. Do not print or copy `.env` secrets.
4. Do not rely only on this prompt or on assumptions. The actual repository/schema must be inspected.

## Project baseline

- Product: Event Management System for a small event-management business in India.
- Roles: Admin and Client only.
- Frontend: Next.js.
- Backend: separate Node.js + Express application.
- Backend language: TypeScript.
- Database: PostgreSQL on Supabase.
- ORM: Prisma 7 (the current generated Prisma Client reported version 7.10.1).
- Prisma config file: `prisma7.config.js`.
- Current Prisma schema path: `prisma/schema.prisma`.
- Current Prisma Client output was configured under `src/generated/prisma`; verify the exact generator block and import path instead of assuming.
- Runtime DB env variable: `DATABASE_URL`.
- Migration DB env variable: `DIRECT_URL`.
- Runtime PostgreSQL access uses the Prisma 7 PostgreSQL driver adapter (`@prisma/adapter-pg` / `pg`) if confirmed in package files.
- Frontend and backend remain separate projects. Do not merge them into a monorepo.
- The app is for one business at this stage. Do not add multi-tenancy.
- Do not add employee/staff roles or task assignment in the first release.

## Business modules to design

1. Authentication and user/role management.
2. Client management.
3. Event management.
4. Invoice and client payment management.
5. Inventory management (items, purchase movements, event issue/allocation, returns, damage, loss, adjustments).
6. Tie-up and collaboration management (restaurants, hotels/banquet partners, event-specific relationship, commission, refundable security deposit, tie-up transactions).
7. Expense management (event and business scopes; transportation, banquet commission, other operating expenses, inventory purchase reconciliation; full/partial expense payments).
8. Owner/personal withdrawals as a separate financial record, not an expense.
9. Admin dashboard and reports.

## Critical business rules to preserve

- Event budget is a planning value, not automatically actual revenue.
- Actual invoiced revenue, payments received, and receivables must be reported separately.
- Event-based expenses include transportation, banquet/tie-up commissions, and other event operating costs.
- Business-level expenses include inventory purchases and other approved business costs.
- Owner withdrawals must remain separate from Expense and must not reduce event profit.
- Inventory purchase is a cash outflow and stock/asset increase; it is not automatically an event's consumed cost. Event profit should account for inventory consumption according to an explicitly selected valuation policy.
- Avoid counting an inventory purchase as both an expense and an event consumption cost.
- Tie-up security deposits are refundable and must be tracked separately from ordinary expenses/revenue.
- Commission belongs to the specific tie-up/event relationship (the existing design uses `TieUpEvent`) and should retain an event-specific commission snapshot.
- A banquet commission expense must reference the correct `TieUpEvent`, and the related event must match.
- Expense payments may be partial, but their aggregate must not exceed the allowed payable amount unless an approved policy says otherwise.
- Stock changes must be represented by inventory movements and updated atomically.
- Client users must only access their own permitted records. Clients must not see internal expenses, inventory costs, tie-up commissions/deposits, or owner withdrawals.
- There are only Admin and Client roles in release one; task assignment is deferred.

## Critical instructions

- Do not invent missing requirements. Mark details as **Confirmed**, **Proposed**, or **Open decision**.
- Do not assume fields, relations, enum values, or model names exist. Verify them in `schema.prisma`.
- Do not recreate the database schema from scratch.
- Do not rename existing models/fields/enums or remove relations without explaining why and identifying migration/data impact.
- Do not use destructive database commands such as `prisma migrate reset` against an existing database.
- Do not expose or repeat secrets from `.env`; only document variable names and safe placeholders.
- Do not silently switch technology stacks, add a monorepo, or add unrelated modules.
- Keep business logic in services; route handlers should not contain complex financial or stock calculations.
- Use Decimal-safe money handling, database transactions, validation, authorization, and idempotency protection for payment/stock operations.
- Where accounting policy is unresolved, present alternatives and their effects; do not select one as fact.
- Make sure each endpoint enforces authorization in the backend, not just in the frontend.

## Required output

Create a detailed file at **`docs/LLD.md`**. Use clear Markdown headings, tables, and Mermaid diagrams. Include all of the following sections:

1. **Document control:** purpose, scope, version/date, assumptions, and status legend.
2. **System overview:** goals, users, boundaries, in-scope and out-of-scope capabilities.
3. **Architecture:** Next.js frontend, Express backend, Prisma 7, PostgreSQL, storage boundary, deployment topology, request/data flow.
4. **Repository audit:** actual folders/files discovered, framework/package versions, Prisma config, generator output, adapter setup, and any inconsistencies. Do not invent files.
5. **Role and permission matrix:** Admin vs Client, resource-level ownership rules, forbidden client data, 401/403 behavior.
6. **Module design:** purpose, actors, features, validations, workflows, dependencies, and failure cases for every module listed above.
7. **Database design:** actual models, fields, enums, relations, cardinalities, indexes, unique constraints, delete behavior, and a Mermaid ER diagram. Clearly distinguish existing schema from recommended changes.
8. **Financial data rules:** invoice/payment math, expense/payment math, commission calculation inputs, deposits, inventory purchase vs consumption, owner withdrawals, event profit formula candidates, rounding and Decimal handling.
9. **Inventory logic:** movement types, stock formula, allocation/return rules, negative stock prevention, reconciliation, and transaction boundaries.
10. **Tie-up logic:** tie-up master, `TieUpEvent`, event-specific commission snapshot, deposit lifecycle, transaction types, and duplicate-counting prevention.
11. **API specification:** route/method, purpose, request shape, response shape, validation, authentication/authorization, status codes, pagination/filtering, and representative examples for each module under `/api/v1`.
12. **Sequence diagrams:** login/session, create event, create invoice and collect partial payment, inventory purchase/issue/return, link tie-up and calculate commission, create/pay expense, record owner withdrawal.
13. **Backend design:** routes, middleware, controllers, services, repositories/data-access (only if useful), Prisma singleton, error handling, logging, config, and module folder structure.
14. **Frontend design:** route map, Admin/Client layouts, protected routes, feature modules, shared components, API integration, forms, tables, loading/empty/error states.
15. **Validation and error model:** common response format, field validation, domain errors, authorization errors, conflict/idempotency handling.
16. **Transactions and consistency:** identify every multi-record operation that must use a Prisma transaction; specify rollback behavior and concurrency risks.
17. **Security:** authentication, password/token/session handling, CORS, CSRF considerations if cookie auth is used, rate limits, secrets, file access, data ownership, audit trail.
18. **Non-functional requirements:** performance for the small initial user base, reliability, maintainability, backups, observability, accessibility, and responsive UX.
19. **Testing strategy:** unit, integration, API, authorization, database transaction, financial reconciliation, inventory consistency, and end-to-end tests. Include acceptance criteria.
20. **Deployment and operations:** environment variables (names only), build/start/migration steps, hosting assumptions, HTTPS, backups, health checks, logs, rollback procedure. Do not claim free tiers are guaranteed forever.
21. **Open decisions:** list every unresolved issue from `plan.md`, explain options, trade-offs, recommendation, and exactly which implementation depends on it.
22. **Implementation sequence:** phased tasks with dependencies, acceptance criteria, and definition of done.
23. **Risks and mitigations:** data loss, double-counted commission, incorrect profit reports, stock drift, unauthorized client access, duplicate payments, and provider limitations.

## Additional deliverables

Also create or update:

- `docs/OPEN_QUESTIONS.md`: only unresolved decisions, each with options, impact, and recommendation.
- `docs/IMPLEMENTATION_ROADMAP.md`: ordered, actionable tasks grouped into phases with dependencies and acceptance criteria.
- A schema-audit section in `docs/LLD.md` that compares this plan to the actual Prisma schema.

## Working procedure

1. First inspect and summarize the repository/schema. Do not edit application code yet.
2. Draft the LLD and list mismatches/open questions.
3. Check that every module and business rule in `plan.md` is represented in the LLD.
4. Check that every proposed schema change has a reason and migration impact.
5. Deliver the three documentation files and a concise summary of what is confirmed, proposed, and blocked by decisions.
6. Wait for explicit approval before making broad schema or application-code changes.

**Quality bar:** The LLD must be concrete enough that another developer can implement the EMS module by module without guessing the business rules, while still marking genuinely unresolved decisions instead of fabricating answers.
