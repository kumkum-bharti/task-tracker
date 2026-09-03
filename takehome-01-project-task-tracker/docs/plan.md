# Development Plan & Execution Summary

### How did you break the work into sessions?

The project was executed in structured, focused development sessions:
1. **Session 1 — Infrastructure & Authentication**:
   - Initialized Node.js backend and React frontend.
   - Defined database schema in Prisma (`schema.prisma`) and ran migrations.
   - Built authentication endpoints (`/api/auth/register`, `/api/auth/login`) with JWT token issuance and password hashing (`bcryptjs`).
   - Created authentication context (`AuthContext.jsx`) and login/register frontend pages.
2. **Session 2 — Projects & Role Security**:
   - Implemented Project CRUD, member assignments, and archiving/restoration endpoints (`/api/projects`).
   - Implemented role-based middleware (`authenticate`, `requireManager`).
   - Built Projects Directory (`ProjectsList.jsx`) and Kanban Project Board (`ProjectBoard.jsx`).
3. **Session 3 — Task Lifecycle, State Machine & Audit Logging**:
   - Built task state machine (`stateMachine.js`) enforcing valid transitions and checking blockers.
   - Built immutable audit logger (`auditLogger.js`) and task history timeline endpoint (`GET /api/tasks/:id/timeline`).
   - Added interactive `TaskCard` and `TaskDetailModal` components with manager task deletion.
4. **Session 4 — Search, Bulk Operations, Alerts & Dashboard**:
   - Implemented server-side search, filtering, sorting, and pagination (`GET /api/tasks`).
   - Implemented bulk status/assignee/due-date updates with per-task error reports (`PATCH /api/tasks/bulk-update`).
   - Built filtered CSV export (`GET /api/tasks/export-csv`).
   - Implemented Overdue Alerts engine (`/api/alerts`) with per-user dismissal resetting on due date edits.
   - Built Manager Analytics Dashboard (`Dashboard.jsx`) featuring headline metrics, Recharts distributions, 8-week completions chart, and team workload table.
5. **Session 5 — UI Polish, Theme Refinement & Documentation**:
   - Refined theme to a modern Slate/Sky-Blue aesthetic with full dark mode support.
   - Added React `ErrorBoundary` and handled unassignment error cases.
   - Completed all system documentation (`ai-prompts.md`, `architecture.md`, `decisions.md`, `plan.md`, `schema.md`).

---

### What order did you build in, and why that order?

1. **Database Schema & Auth Middleware First**:
   - *Why*: All project and task operations rely on user identity (`req.user.id`) and role checks (`MANAGER` vs `MEMBER`).
2. **Projects CRUD & Member Management**:
   - *Why*: Tasks belong to projects, and task assignees must be members of the task's project.
3. **Task Engine, State Machine & Audit Trail**:
   - *Why*: Core domain logic (blockers, legal transitions, immutable history) must be sound before building search or bulk operations.
4. **Server-Side Search & Bulk Operations**:
   - *Why*: Search and bulk operations depend on existing task querying and state machine validation logic.
5. **Dashboard, Alerts & Visual UI Polish**:
   - *Why*: Dashboard aggregations and overdue alert badges aggregate real data generated in earlier phases.

---

### What did you estimate versus what it actually took?

| Feature Area | Estimated Time | Actual Time | Notes / Reason |
| :--- | :---: | :---: | :--- |
| **Prisma Schema & Auth API** | 1.0 hr | 0.8 hr | Prisma schema auto-generation saved significant setup time. |
| **Projects & Member Management** | 1.5 hrs | 1.2 hrs | Modal integration on frontend went smoothly. |
| **Task State Machine & Blocker Rules** | 2.0 hrs | 2.5 hrs | Needed careful handling of `blockedFrom` restoration and blocker checks. |
| **Audit Logging & Timeline** | 1.0 hr | 1.0 hr | Simple append-only model. |
| **Server-side Search & Pagination** | 1.5 hrs | 1.5 hrs | Prisma dynamic `where` and `count` worked cleanly. |
| **Bulk Actions & Per-task Error Reporting**| 1.5 hrs | 2.0 hrs | Requiring partial success response reporting required extra loop validation logic. |
| **Dashboard Aggregations & Charts** | 1.5 hrs | 1.5 hrs | Recharts integrated easily with backend aggregations. |
| **Overdue Alerts & Dismissals** | 1.0 hr | 1.0 hr | `AlertDismissal` reset logic on due date change was straightforward. |
| **UI Styling & Error Boundaries** | 1.0 hr | 1.5 hrs | Spent extra time perfecting Slate/Sky-Blue dark theme and fixing unassign edge cases. |

---

### What did you cut when you ran short?

- **Real-Time WebSockets**: Substituted with targeted React window event dispatchers (`window.dispatchEvent(new Event('task-updated'))`) which achieved instant cross-component UI synchronization without socket server complexity.
- **Complex Rich Text Editor for Comments**: Kept comments as clean multiline plain text to preserve performance and audit trail simplicity.
- **Drag-and-Drop Board View (Stretch)**: Considered `@dnd-kit/core` but correctly identified this as a stretch goal. Time was better spent hardening the state machine and bulk operation edge cases.
- **Cycle Detection in Blocker Chains (Stretch)**: The current blocker check is single-hop (does task X have any unfinished blocking tasks?). Cycle detection across a chain of N tasks would require a recursive CTE or iterative traversal — valuable but not required by the spec.
- **Email Notifications**: Would have required a third-party SMTP service (Resend, Sendgrid), adding deployment configuration overhead with no spec-mandated payoff.

---

### Session-by-Session Reasoning: Why Each Session Unblocked the Next

**Why Session 1 (Auth) had to be first**: Every subsequent API endpoint needs `req.user.id` to scope data to the right person. Without authentication middleware working, no other route could be written safely. The database schema had to be finalized here too — changing it later would require new migrations and potentially breaking changes to all existing routes.

**Why Session 2 (Projects) came second**: Tasks belong to projects, and task assignees must be project members. If projects and membership were not modelled correctly before building tasks, the task creation endpoint would have no `projectId` to attach to, and the member validation logic in task assignment would be checking against a non-existent `ProjectMember` table.

**Why Session 3 (Task Engine) was third**: The state machine and audit logger are used by bulk operations (Session 4). If bulk operations were written before `stateMachine.js` existed, bulk would either have duplicated transition validation logic (creating two sources of truth) or skipped it entirely. Building the core domain logic first meant Session 4 could import and reuse it with confidence.

**Why Session 4 (Search, Bulk, Alerts, Dashboard) came fourth**: All four of these features are consumers of the data model — they read and aggregate data without defining new structural relationships. They could only be built meaningfully once real task data existed in the system from Session 3 testing.

**Why Session 5 (Polish) was last**: CSS theming, error boundaries, and documentation do not affect functionality. They are the correct final pass — adding them earlier would have introduced visual/styling regressions each time a component was significantly restructured during Sessions 2–4.

---

### What the Time Estimates Taught

The two areas that overran estimates were the **Task State Machine** (+0.5 hrs) and **Bulk Actions** (+0.5 hrs). In both cases, the overrun was caused by edge cases that were not obvious until testing with real data:

- **State Machine**: The `blockedFrom` storage approach required a full pivot mid-session (see `decisions.md` Decision 10). What looked like a 2-hour task became 2.5 hours because the first implementation had to be discarded and rewritten.
- **Bulk Actions**: The partial success reporting format — `{ updatedCount, updatedIds, failed: [{id, title, reason}] }` — required careful frontend handling. The initial `BulkResultModal` component showed only a count summary. A second iteration was needed to display per-task failure reasons in a readable format, consuming the extra 0.5 hours.

Everything else tracked closely to estimates because the Prisma schema was sound and the modular route structure kept each feature isolated.

---

### Build Order Retrospective

If starting again with the same 12-hour budget:

1. **Keep Session 1 and 2 the same** — auth and projects are non-negotiable foundations.
2. **Start writing `seed.js` at the end of Session 2**, not Session 5. Having realistic demo data from the midpoint of development would have caught the "overdue alerts are empty" seed bug 3 sessions earlier.
3. **Write the `stateMachine.js` unit tests** alongside Session 3. The `blockedFrom` bug (Decision 10) would have been caught by a simple test asserting `unblock → returns to blockedFrom value` without needing manual UI testing.
4. **Merge Session 4 alerts work into Session 3** — the `AlertDismissal` model is tightly coupled to task due date changes, and building it alongside the task engine would have naturally led to the `dueDateAtDismissal` approach sooner.
