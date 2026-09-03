# Architecture

### What are the moving pieces, and how do they talk to each other?

The system consists of three core components:
1. **Frontend (React + Vite SPA)**:
   - Single Page Application built with React, React Router DOM, Recharts, and Lucide React icons.
   - Styled with custom CSS variables (Slate/Sky-Blue aesthetic) supporting light and dark themes.
   - Communicates with the backend REST API via Axios (`client.js`) using JSON request/response payloads.
   - Stores JWT token in `localStorage` and injects it into every request via an Axios interceptor (`Authorization: Bearer <token>`).

2. **Backend (Node.js + Express REST API)**:
   - Express web server using ES Modules syntax (`server.js`).
   - Modularized into REST routes (`/api/auth`, `/api/users`, `/api/projects`, `/api/tasks`, `/api/bulk`, `/api/dashboard`, `/api/alerts`).
   - Enforces authentication (`authenticate` middleware) and role-based access control (`requireManager` middleware).
   - Encapsulates domain business logic in dedicated helper modules:
     - `stateMachine.js`: Task transition state machine validation.
     - `auditLogger.js`: Immutable audit event logging.
   - Uses Prisma ORM (`@prisma/client`) to execute type-safe database queries.

3. **Database (PostgreSQL via Supabase / Local PostgreSQL)**:
   - Relational database storing users, projects, project members, tasks, task assignees, task blockers, task events, and alert dismissals.
   - Managed via Prisma schema (`schema.prisma`) and migrations.

---

### Where does each piece run?

- **Frontend**: Runs in the user's browser (served locally via Vite dev server on `http://localhost:5173`, or deployable to Vercel/Netlify).
- **Backend API**: Runs as a Node.js process (locally via Nodemon/Node on `http://localhost:3000`, or deployable to Render/Railway).
- **Database**: Managed PostgreSQL instance hosted on Supabase (or local PostgreSQL instance).

---

### What is the request path for one representative user action, end to end?

**Representative Action**: A Manager performs a bulk status update to move 3 tasks to `DONE` from the Global Task Finder page.

1. **User Interaction (Frontend)**:
   - User selects 3 task checkboxes in `TaskSearch.jsx`, picks `Action: Status Move` with target value `DONE`, and clicks `Apply Bulk Change`.
2. **HTTP Request**:
   - Axios client constructs a `PATCH http://localhost:3000/api/tasks/bulk-update` HTTP request with JSON body `{ taskIds: [1, 2, 3], actionType: "status", value: "DONE" }`.
   - The request header includes `Authorization: Bearer <jwt_token>`.
3. **Middleware Execution (Backend)**:
   - `server.js` routes the request to `bulk.js`.
   - `authenticate` middleware verifies the JWT signature, extracts `req.user` (`{ id, role: "MANAGER" }`), and passes control.
4. **Business Logic & Validation**:
   - `bulk.js` fetches the 3 tasks along with their `blockedBy` tasks.
   - For each task, `validateTransition(task.status, "DONE", task.blockedFrom)` is called.
   - If a task is in `BACKLOG`, `validateTransition` marks it invalid with reason: *"Cannot move from BACKLOG to DONE. Task must pass through IN_PROGRESS and IN_REVIEW first."*
   - If a task has unfinished blockers, it is marked invalid with reason listing the blocker IDs.
5. **Database Mutation**:
   - Valid tasks are updated inside a Prisma database transaction (`prisma.$transaction`).
   - For each updated task, `logStatusChange` creates an immutable `TaskEvent` row.
6. **HTTP Response**:
   - Backend sends `200 OK` JSON response:
     ```json
     {
       "updatedCount": 1,
       "updatedIds": [2],
       "failed": [
         { "id": 1, "title": "Setup DB", "reason": "Cannot move from BACKLOG to DONE..." }
       ]
     }
     ```
7. **UI Update (Frontend)**:
   - React receives the response, triggers `fetchTasks()` to refresh the server task table, clears checkboxes, and displays `BulkResultModal` showing 1 succeeded task and 2 rejected tasks with exact reasons.

---

### What did you decide *not* to build, and why?

1. **WebSockets / Real-Time Sockets**:
   - **Why**: HTTP polling and custom window event dispatchers (`window.dispatchEvent(new Event('task-updated'))`) provided instant reactivity across UI components without adding WebSocket server infrastructure or connection drop handling overhead.
2. **GraphQL API**:
   - **Why**: REST endpoints with Prisma `include` clauses allowed precise, minimal payload fetching for task trees, audit logs, and dashboard aggregations with zero extra schema setup time.
3. **Editable Audit Log Routes**:
   - **Why**: Requirement 9 explicitly dictates that task history must be strictly immutable. We deliberately omitted any `PUT`, `PATCH`, or `DELETE` endpoints for the `TaskEvent` model.

4. **A Separate Comment Table**:
   - **Why**: Comments are just another event in the timeline — treating them differently would split the chronological view, requiring a `UNION` or multiple API calls to reconstruct a unified history per task. Using `TaskEvent` with `eventType: "COMMENT"` and a `commentText` field keeps the history a single append-only query: `SELECT * FROM TaskEvent WHERE taskId = ? ORDER BY createdAt ASC`.

5. **Role Hierarchies Beyond Two Levels**:
   - **Why**: The spec defines exactly two roles — manager and member. Engineering a RBAC system with permission bitfields or a roles table would have taken 2–3 hours of additional work and configuration, with zero payoff for the spec. A two-value `Role` enum checked in middleware is both sufficient and auditable.

6. **Optimistic UI Updates**:
   - **Why**: Optimistic updates require a rollback mechanism when server validation rejects a move (e.g. illegal state transition, blocked task). Since the spec mandates server-side rejection with detailed per-task error messages, any optimistic update would need to be immediately rolled back — adding complexity with no user-perceived benefit given the fast backend response times.

---

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  React SPA (Vite build, hosted on Vercel)                │  │
│   │                                                          │  │
│   │  ┌──────────┐  ┌────────────┐  ┌─────────────────────┐  │  │
│   │  │AuthContext│  │React Router│  │Axios Client          │  │  │
│   │  │(JWT store)│  │(SPA routes)│  │(Bearer token inject) │  │  │
│   │  └──────────┘  └────────────┘  └──────────┬──────────┘  │  │
│   │                                            │              │  │
│   └────────────────────────────────────────────┼─────────────┘  │
└────────────────────────────────────────────────┼────────────────┘
                                                 │ HTTPS REST API
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js + Express API (hosted on Render)           │
│                                                                  │
│   ┌──────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│   │ CORS     │  │ authenticate() │  │ requireManager()       │  │
│   │ Middleware│  │ (JWT verify)   │  │ (Role Guard)           │  │
│   └──────────┘  └────────────────┘  └────────────────────────┘  │
│                                                                  │
│   Route Modules:                                                 │
│   /api/auth      /api/projects   /api/tasks                      │
│   /api/bulk      /api/dashboard  /api/alerts   /api/users        │
│                                                                  │
│   Domain Libraries:                                              │
│   ┌────────────────┐   ┌──────────────────┐                      │
│   │ stateMachine.js│   │ auditLogger.js   │                      │
│   │ (Transition    │   │ (Immutable event │                      │
│   │  validation)   │   │  log writer)     │                      │
│   └───────┬────────┘   └────────┬─────────┘                      │
│           │                    │                                  │
│           └────────┬───────────┘                                  │
│                    │ Prisma ORM                                   │
│                    ▼                                              │
└─────────────────────────────────────────────────────────────────┘
                                 │ PostgreSQL Wire Protocol
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│          PostgreSQL Database (Supabase managed instance)         │
│                                                                  │
│  Tables: User, Project, ProjectMember, Task, TaskAssignee,       │
│          TaskBlocker, TaskEvent (append-only), AlertDismissal    │
└─────────────────────────────────────────────────────────────────┘
```

---

### Deployment Topology (Production)

| Layer | Technology | Host | URL |
|:------|:-----------|:-----|:----|
| Frontend SPA | React 19 + Vite 8 | Vercel (CDN Edge) | `https://task-tracker-five-neon.vercel.app` |
| Backend API | Node.js + Express 5 | Render (Free tier) | `https://task-tracker-dexi.onrender.com` |
| Database | PostgreSQL 15 | Supabase (Free tier) | AWS ap-northeast-1 region |

**Key environment-variable wiring**:
- Frontend reads `VITE_API_URL` at build time (Vite inlines it into the JS bundle).
- Backend reads `DATABASE_URL`, `DIRECT_URL` (Supabase connection pooler vs. direct connection for Prisma migrations), `JWT_SECRET`, and `FRONTEND_URL` (used in CORS `allowedOrigins` array).
- No secrets are committed to the repository; the `.env` file is in `.gitignore`.

**Cold start note**: The Render free tier spins down after 15 minutes of inactivity. The first API call after a sleep period may take 30–60 seconds. This is noted in `SUBMISSION.md`.

---

### Detailed End-to-End Request Lifecycle: "Move Task to DONE via Bulk Update"

This is a narrative walkthrough of one complete request to illustrate how all layers collaborate.

**Context**: A manager is on the Global Task Search page (`/tasks`). They have checked three tasks and selected `Status → DONE` from the bulk action dropdown. They click **Apply**.

**Step 1 — User Gesture**
The click handler in `TaskSearch.jsx` reads `selectedTaskIds` (a `Set` maintained in component state) and `bulkAction` (the selected operation type and value). It calls `applyBulkAction()`.

**Step 2 — Axios HTTP Request Construction**
`applyBulkAction()` calls `api.patch('/tasks/bulk-update', { taskIds: [...selectedTaskIds], actionType: 'status', value: 'DONE' })`. The Axios instance defined in `client.js` automatically prepends `VITE_API_URL` (`https://task-tracker-dexi.onrender.com/api`) and injects `Authorization: Bearer <JWT>` via a request interceptor.

**Step 3 — CORS Pre-flight (OPTIONS)**
The browser first sends an HTTP OPTIONS pre-flight to Render. The Express `cors()` middleware checks the `Origin` header against `allowedOrigins` (which includes the Vercel frontend URL, injected from `FRONTEND_URL` env var). It returns `Access-Control-Allow-Origin` and the request proceeds.

**Step 4 — Express Middleware Chain**
`server.js` routes the PATCH to `bulk.js`. The `authenticate` middleware runs first: it reads the `Authorization` header, calls `jwt.verify(token, process.env.JWT_SECRET)`, and if valid, attaches `req.user = { id: 5, role: 'MANAGER' }`. If the token is expired or tampered, it immediately returns `401 Unauthorized`.

**Step 5 — Business Logic Loop in `bulk.js`**
The handler fetches all three tasks from PostgreSQL via Prisma, including their `blockedBy` tasks. For each task, it calls `validateTransition(task.status, 'DONE', task.blockedFrom)`:
- Task A (`IN_REVIEW`, no blockers) → **valid**.
- Task B (`BACKLOG`) → **invalid**: `"Cannot transition from BACKLOG to DONE. Expected IN_REVIEW."`.
- Task C (`IN_PROGRESS`, has an unfinished blocker) → **invalid**: `"Task is blocked by unfinished tasks: [#12]."`.

**Step 6 — Prisma Transaction**
Task A is updated inside `prisma.$transaction([...])`. Inside the same transaction, `logStatusChange(taskId, actorId, 'IN_REVIEW', 'DONE')` creates an immutable `TaskEvent` row with `eventType: 'STATUS_CHANGED'`, `oldValue: 'IN_REVIEW'`, `newValue: 'DONE'`.

**Step 7 — HTTP Response**
The API responds with `200 OK`:
```json
{
  "updatedCount": 1,
  "updatedIds": [7],
  "failed": [
    { "id": 3, "title": "Write API docs", "reason": "Cannot transition from BACKLOG to DONE..." },
    { "id": 9, "title": "Deploy backend", "reason": "Task is blocked by unfinished tasks: [#12]" }
  ]
}
```

**Step 8 — Frontend UI Update**
React receives the response. It calls `fetchTasks()` to refresh the paginated task table from the server (server-side source of truth). It clears `selectedTaskIds`. It renders `<BulkResultModal>` displaying "1 task updated, 2 rejected" with the exact reason strings from the server — so the user understands precisely why each failure occurred.

---

### Cross-Component Event Synchronization

Because the app is a SPA without WebSockets, state changes in one component (e.g., a task status update inside `TaskDetailModal`) need to propagate to other components (e.g., the task list in `ProjectBoard`). This is done via browser custom events:

```js
// After a successful PATCH /api/tasks/:id
window.dispatchEvent(new Event('task-updated'));
```

Any component that needs to react registers a listener on mount:
```js
useEffect(() => {
  const handler = () => fetchProjectData();
  window.addEventListener('task-updated', handler);
  return () => window.removeEventListener('task-updated', handler);
}, []);
```

This is a lightweight pub/sub pattern that avoids prop-drilling, Redux, or WebSocket infrastructure entirely — appropriate for the scale of this application.

