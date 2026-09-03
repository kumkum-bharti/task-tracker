# Submission

## Links

- **GitHub repository:** https://github.com/kumkum-bharti/task-tracker
- **Live application:** https://task-tracker-five-neon.vercel.app

## Notes for the reviewer

The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. The **first API call after an idle period may take 30–60 seconds** to respond while the instance wakes up. This is expected — subsequent requests will be fast. Please wait for the initial load before assuming the application is broken.

The database is hosted on Supabase (PostgreSQL, AWS ap-northeast-1 region). It is always live and does not sleep.

## Demo credentials

| Role    | Email                    | Password     |
|---------|--------------------------|--------------|
| Manager | manager@busytracker.com  | manager123   |
| Member  | alice@busytracker.com    | member123    |
| Member  | bob@busytracker.com      | member123    |

The Manager account can create/archive projects, manage members, and delete tasks. Member accounts can only see projects they are assigned to and manage their own tasks.

The database has been seeded with 3 sample projects, 15+ tasks across all statuses (including overdue tasks), assignees, blocker relationships, and task history events so the system demonstrates real data immediately on login.

## Stack

| Layer     | What you used                                   | Why                                                                                                 |
|-----------|------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Frontend  | React 19 + Vite 8 + React Router DOM + Recharts | Fastest stack for a full SPA with charts; Vite's dev speed and small bundle size suit a timed build. |
| Backend   | Node.js + Express 5 + Prisma ORM + JWT         | Maximum productivity with ES Modules; Prisma gives type-safe queries and schema-driven migrations.   |
| Database  | PostgreSQL 15 via Supabase                      | Free managed PostgreSQL with connection pooling; no infrastructure to configure.                    |
| Hosting   | Vercel (frontend) + Render (backend)           | Both have generous free tiers; Vercel's CDN edge serves the React bundle fast from anywhere.         |

## Goal checklist

| # | Goal                            | Status  | Notes                                                                                                  |
|---|---------------------------------|---------|--------------------------------------------------------------------------------------------------------|
| 1 | Accounts and roles              | Done    | `MANAGER` and `MEMBER` roles enforced server-side via `authenticate` and `requireManager` middleware.  |
| 2 | Projects                        | Done    | Full CRUD, archiving, restoration, and member management. Archived projects hidden from default views. |
| 3 | Tasks inside projects           | Done    | Tasks with title, description, priority, due date, and blocker relationships. Full CRUD per project.  |
| 4 | Task lifecycle with rules       | Done    | `stateMachine.js` enforces legal transitions server-side. `blockedFrom` stores pre-block state.       |
| 5 | Assignment                      | Done    | Many-to-many via `TaskAssignee`. Only project members assignable. Removing member unassigns all tasks. |
| 6 | Finding things                  | Done    | 100% server-side search, filter, sort, and pagination via `GET /api/tasks`. Never loads all tasks.    |
| 7 | Acting on many tasks at once    | Done    | `PATCH /api/tasks/bulk-update` with per-task success/failure reporting. CSV export working.            |
| 8 | Dashboard                       | Done    | Headline metrics, status distribution (pie), assignee workload (bar), 8-week completions (line).      |
| 9 | History you cannot rewrite      | Done    | Append-only `TaskEvent` table. No update/delete routes exist for events. Comments in same timeline.    |
| 10 | Overdue alerts                  | Done    | Alert reappears if `task.dueDate != AlertDismissal.dueDateAtDismissal`. Nav badge shows live count.    |

## How much time did you actually spend?

Approximately **12 hours** total, spread across 5 sessions over a week:

- Session 1 (Auth + Schema): ~1.8 hrs
- Session 2 (Projects + RBAC): ~1.2 hrs
- Session 3 (Task Engine + State Machine + Audit): ~2.5 hrs
- Session 4 (Search + Bulk + Alerts + Dashboard): ~4.5 hrs
- Session 5 (UI Polish + Deployment + Docs): ~2.0 hrs

## What would you do next, with another 12 hours?

1. **Add unit tests for `stateMachine.js`** — the state machine is the most critical business logic in the app and currently has no automated test coverage. Catching transition edge cases (e.g., double-block, unblock to wrong state) earlier would have saved debugging time.
2. **Switch JWT storage from localStorage to HttpOnly cookies** — the current localStorage approach is functionally correct for a same-origin app but is XSS-vulnerable. HttpOnly cookies with CSRF protection is the production-correct pattern.
3. **Add PostgreSQL Full-Text Search** — the current `ILIKE %query%` title/description search does not use an index. A `tsvector` GIN index would make search fast at scale.
4. **Implement cycle detection for blocker chains** — currently the system only checks direct blockers. A task chain like A → B → C → A would not be detected as a cycle, creating an impossible-to-complete set of tasks.
5. **Add a drag-and-drop Kanban board** — the project board currently uses a list view. A `@dnd-kit/core` Kanban implementation with state machine validation on drop would be the most impactful UX improvement.

## What are you least happy with in this codebase, and why?

The **alert dismissal query** (`GET /api/alerts`). It uses a Prisma `OR` clause combining `alerts: { none: ... }` and `alerts: { some: { dueDateAtDismissal: { not: ... } } }`. While functionally correct, this generates a suboptimal SQL query with two separate EXISTS subqueries that are not index-friendly at scale. A raw SQL query using a LEFT JOIN with a WHERE condition on `dueDateAtDismissal` would be far more efficient and readable. I kept the Prisma version to stay consistent with the rest of the codebase, but it is the one place where the ORM abstraction is working against clarity.
