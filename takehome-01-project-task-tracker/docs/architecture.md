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
