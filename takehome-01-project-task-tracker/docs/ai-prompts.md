# AI Prompts Log

This document records the actual AI prompts used throughout the development of BusyTracker, grouped by development goal. Each entry shows the exact prompt, what was generated, and what was wrong or corrected — including the debugging and error-fixing prompts that came after.

---

## 1. Project Scaffolding & Initial Setup

### Prompt
> I am building a full-stack project and task tracking web application. The stack will be:
> - Backend: Node.js with Express 5, ES Modules (import/export syntax, NOT CommonJS), Prisma ORM, PostgreSQL (hosted on Supabase), bcryptjs for password hashing, jsonwebtoken for JWT auth, cors, dotenv
> - Frontend: React 19 with Vite, React Router DOM v7, Axios for HTTP calls, Recharts for charts, Lucide React for icons
>
> Set up the folder structure for both. Backend should have: server.js at root, src/routes/, src/middleware/, src/lib/. Frontend should have: src/pages/, src/components/, src/context/, src/api/. Initialize both with package.json. Backend should run on port 3000. Frontend should proxy to backend in dev mode. Include a .gitignore for both.

### What you got
Complete folder scaffolding with `package.json` for both backend and frontend, a basic `server.js` stub, Vite config with proxy setting, and a `.gitignore`.

### What you corrected
- The Vite config generated used `proxy: { '/api': 'http://localhost:5000' }` — wrong port. Changed to `3000`.
- The backend `package.json` was missing `"type": "module"` which is required for ES Module `import` syntax to work with Node.js. Added it manually.
- The frontend `package.json` had `@vitejs/plugin-react-swc` but the project should use the standard `@vitejs/plugin-react`. Corrected the dependency.

---

## 2. Database Schema Design in Prisma

### Prompt
> Design a complete Prisma schema for a project and task tracking system with these requirements:
>
> - Users have email (unique), passwordHash, name, and a role which is either MANAGER or MEMBER
> - Projects have a short unique key (like "PROJ-1"), name, description (optional), isArchived boolean, an owner (User), and timestamps
> - ProjectMember is a join table between Project and User tracking when they joined
> - Tasks belong to exactly one Project, have title, description (optional), priority (LOW/MEDIUM/HIGH/URGENT), status (BACKLOG/IN_PROGRESS/IN_REVIEW/DONE/BLOCKED), an optional blockedFrom field that stores TaskStatus, an optional dueDate, creator (User), and timestamps
> - TaskAssignee is a join table between Task and User
> - TaskBlocker is a self-referential join table between Task and Task (a task can block another task)
> - TaskEvent is an immutable audit log: eventType (string), optional fieldName, oldValue, newValue, commentText, linked to Task and actor (User)
> - AlertDismissal tracks when a user dismisses an overdue alert for a task, and stores the dueDateAtDismissal so we can re-surface the alert if the due date later changes
>
> Add appropriate indexes for foreign keys and frequently queried columns. Use cascade deletes where appropriate.

### What you got
Complete `schema.prisma` with all 8 models, proper enums, `@@id` composite keys, `@@index` directives, and `onDelete: Cascade` on join tables.

### What you corrected
- `TaskBlocker` was missing `onDelete: Cascade` — if a task is deleted, its blocker relationships should also be deleted automatically. Added `onDelete: Cascade` to both sides.
- `AlertDismissal` had `@@unique([taskId, userId])` missing — this constraint is what prevents double-dismissal and enables idempotent upsert. Added it.
- The `Task` model was missing the `@@index([status])` index — the global task search filters heavily on status. Added it.

---

## 3. Authentication API (Register + Login)

### Prompt
> Build the authentication routes for the Express backend using ES Modules. Create src/routes/auth.js with:
> - POST /api/auth/register: accepts { name, email, password }, hashes the password with bcryptjs (salt rounds: 10), creates a User in the database using Prisma, returns a JWT token
> - POST /api/auth/login: accepts { email, password }, finds the user by email, compares password with bcrypt.compare, returns a JWT token with { userId } as payload and 7-day expiry
> - If email already exists on register, return 400 with error message
> - If login fails (wrong email or wrong password), return 401
> - JWT_SECRET must come from process.env.JWT_SECRET
>
> Also create src/middleware/auth.js with:
> - authenticate(req, res, next): verifies JWT from Authorization: Bearer <token> header, attaches req.user = { id, role } on success, returns 401 on failure
> - requireManager(req, res, next): checks req.user.role === 'MANAGER', returns 403 if not

### What you got
Complete `auth.js` route and middleware files with correct bcryptjs and jsonwebtoken usage.

### What you corrected
- The generated `authenticate` middleware used `jwt.decode()` instead of `jwt.verify()`. `decode()` does NOT verify the signature — any tampered token would pass. Changed to `jwt.verify(token, process.env.JWT_SECRET)`.
- The login endpoint was returning the full user object (including `passwordHash`) in the response. Removed `passwordHash` from the response body.
- The `requireManager` check was placed before `authenticate` in the middleware chain suggestion, which would fail because `req.user` is set by `authenticate`. Fixed ordering to: `authenticate` first, then `requireManager`.

---

## 4. Projects API (Full CRUD + Member Management + Archiving)

### Prompt
> Build src/routes/projects.js with these endpoints using Prisma and ES Modules:
> - GET /api/projects: Managers see all non-archived projects. Members see only non-archived projects they are a member of (via ProjectMember table). Both filter out archived projects by default.
> - POST /api/projects: Manager only. Create project with { key, name, description, ownerId }. Auto-add the owner as a ProjectMember.
> - GET /api/projects/:id: Return the project with its members and tasks (basic list).
> - PATCH /api/projects/:id: Manager only. Update name, description, ownerId.
> - POST /api/projects/:id/archive: Manager only. Set isArchived = true.
> - POST /api/projects/:id/restore: Manager only. Set isArchived = false.
> - GET /api/projects/:id/members: Return all members of the project.
> - POST /api/projects/:id/members: Manager only. Add a user to the project.
> - DELETE /api/projects/:id/members/:userId: Manager only. Remove user from project AND unassign them from all tasks in that project.
> - GET /api/users: Return all users (for dropdowns when adding members).
>
> All endpoints require authentication. Manager-only endpoints need requireManager middleware.

### What you got
Complete projects route file with all 9 endpoints.

### What you corrected
- The member removal endpoint (`DELETE /api/projects/:id/members/:userId`) was only deleting the `ProjectMember` row but not unassigning the user from tasks in that project. Added a `prisma.taskAssignee.deleteMany({ where: { userId, task: { projectId } } })` call before removing the member.
- The `GET /api/projects` endpoint was not filtering by `isArchived: false` — it returned all projects including archived ones. Added the filter.
- For members, the `include` block was missing `user: { select: { id, name, email, role } }` — the frontend needed user details, not just the userId foreign key. Added the include.

---

## 5. Task State Machine

### Prompt
> Build src/lib/stateMachine.js that exports a function validateTransition(fromStatus, toStatus, blockedFrom).
>
> Rules:
> - Legal forward transitions: BACKLOG → IN_PROGRESS → IN_REVIEW → DONE
> - From IN_PROGRESS or IN_REVIEW, a task can move to BLOCKED
> - BLOCKED can only return to the value stored in blockedFrom (either IN_PROGRESS or IN_REVIEW)
> - DONE can move back to IN_PROGRESS (reopen)
> - Any other transition should return { valid: false, reason: "Cannot transition from X to Y. Allowed next states are: [...]" }
> - If moving to DONE and a task has unfinished blockers, that check is done separately — this function only validates the transition path itself
>
> The function should return { valid: true } or { valid: false, reason: string }.

### What you got
A `validateTransition` function with a transition map and a switch/case structure.

### What you corrected
- The initial implementation did not handle the `BLOCKED → blockedFrom` case correctly. It hardcoded `BLOCKED → IN_PROGRESS` instead of using the `blockedFrom` parameter. If a task was blocked from `IN_REVIEW`, calling `validateTransition('BLOCKED', 'IN_PROGRESS', 'IN_REVIEW')` would incorrectly return `valid: true`. Fixed to `if (toStatus === blockedFrom) return { valid: true }`.
- The `DONE → IN_PROGRESS` (reopen) transition was missing from the allowed transitions map. Added it.
- Error messages did not list the legal next states, making them unhelpful. Rewrote the reason strings to say: `"Cannot transition from BACKLOG to DONE. Legal next states from BACKLOG: IN_PROGRESS."`.

---

## 6. Tasks API (CRUD + State Transitions + Blockers + Timeline)

### Prompt
> Build src/routes/tasks.js with:
> - GET /api/tasks: Server-side search with query params: search (text search on title + description using ILIKE), projectId, status, assigneeId, priority, overdue (boolean). Plus sort by dueDate/priority/updatedAt, pagination with page and limit. Return { tasks, total, page, totalPages }. Members can only see tasks from projects they are in.
> - POST /api/projects/:projectId/tasks: Create a task. Auto-log a CREATED TaskEvent.
> - GET /api/tasks/:id: Return task with assignees, blockedBy tasks, events timeline, and project info.
> - PATCH /api/tasks/:id: Update title, description, priority, dueDate, status, blockers. Status changes must go through validateTransition. Log field changes to TaskEvent via auditLogger.
> - DELETE /api/tasks/:id: Manager only. Hard delete.
> - POST /api/tasks/:id/assignees: Add an assignee. User must be a ProjectMember. Log ASSIGNED event.
> - DELETE /api/tasks/:id/assignees/:userId: Remove an assignee. Log UNASSIGNED event.
> - POST /api/tasks/:id/comments: Add a comment. Log COMMENT event to TaskEvent.
> - GET /api/tasks/:id/timeline: Return all TaskEvents for this task ordered by createdAt ASC, with actor name.

### What you got
Complete tasks route with all endpoints implemented.

### What produced something wrong — Error fixing prompts used:

**Error 1 — 500 on unassigning a user:**
> The DELETE /api/tasks/:id/assignees/:userId endpoint is throwing "500 Internal Server Error". The Prisma error in logs is: "An operation failed because it depends on one or more records that were required but not found. {cause: 'Record to delete does not exist.'}". Here is the current code: `await prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } })`. Fix this so it does not throw a 500 if the record doesn't exist.

**Fix applied:** Changed to `await prisma.taskAssignee.deleteMany({ where: { taskId, userId } })` — `deleteMany` does not throw on 0 matches.

**Error 2 — Status transition not rejecting illegal moves:**
> The PATCH /api/tasks/:id status update is not calling validateTransition before updating. It is setting any status directly to the database. I need it to: 1) fetch current task.status and task.blockedFrom from DB, 2) call validateTransition(current, newStatus, blockedFrom), 3) if invalid, return 400 with the reason string. Also check if moving to DONE: fetch all blockedBy tasks and verify all are status === 'DONE'. If not, return 400 with which blocker IDs are unfinished.

**Fix applied:** Added pre-update validation block calling `validateTransition` and separate blocker completion check using `prisma.taskBlocker.findMany` with `include: { blockingTask: true }`.

**Error 3 — React crash when opening task after assignee change:**
> After adding an assignee to a task and closing the modal, reopening any task detail crashes React with: "TypeError: Cannot read properties of null (reading 'name')". The crash is in TaskCard.jsx at line: assignees.map(a => a.user.name). The assignees array from the server sometimes has objects where user is null. How do I fix this defensive coding issue?

**Fix applied:** Added optional chaining: `a.user?.name || 'Unknown'` in `TaskCard.jsx` and `TaskDetailModal.jsx`. Also added functional state update pattern `setSelectedTask(prev => ...)` to avoid stale closure issues after async fetch.

---

## 7. Immutable Audit Logger

### Prompt
> Build src/lib/auditLogger.js that exports these functions, all using Prisma to write TaskEvent rows:
> - logCreated(taskId, actorId): eventType = 'CREATED'
> - logStatusChange(taskId, actorId, fromStatus, toStatus): eventType = 'STATUS_CHANGED', oldValue = fromStatus, newValue = toStatus
> - logFieldChange(taskId, actorId, fieldName, oldValue, newValue): eventType = 'FIELD_CHANGED'
> - logAssigned(taskId, actorId, assigneeId): eventType = 'ASSIGNED', newValue = assigneeId as string
> - logUnassigned(taskId, actorId, assigneeId): eventType = 'UNASSIGNED', oldValue = assigneeId as string
> - logComment(taskId, actorId, commentText): eventType = 'COMMENT', commentText = commentText
>
> None of these functions should ever throw — wrap in try/catch and log errors but don't let audit failures crash the main request.

### What you got
Complete `auditLogger.js` with all 6 helper functions.

### What you corrected
- The functions were not wrapped in try/catch — an audit write failure (e.g., DB timeout) would bubble up and cause the main API request to fail. Added `try { ... } catch (e) { console.error('Audit log failed:', e) }` to each function.
- `logAssigned` and `logUnassigned` were storing userId as a number. The `TaskEvent.newValue` column is a `String?`. Added `.toString()` conversion.

---

## 8. Bulk Operations & CSV Export

### Prompt
> Build src/routes/bulk.js with:
> - PATCH /api/tasks/bulk-update: Accepts { taskIds: number[], actionType: 'status' | 'assignee' | 'dueDate', value: string }. For each taskId, apply the change independently. If the change is invalid for a specific task (illegal state transition, user not a project member, etc.), record it as failed with a reason. Return: { updatedCount: number, updatedIds: number[], failed: [{ id, title, reason }] }. Do NOT fail the whole batch because one task failed.
> - GET /api/tasks/export-csv: Accept the same filter params as GET /api/tasks (search, projectId, status, assigneeId, priority, overdue). Fetch all matching tasks (no pagination limit). Convert to CSV using json2csv. Return as a file download with Content-Disposition: attachment.

### What you got
Both endpoints implemented with correct partial-success logic and json2csv usage.

### What you corrected

**Error — CSV returned as plain text instead of download:**
> The GET /api/tasks/export-csv endpoint returns the CSV data but the browser shows it as raw text instead of triggering a file download. How do I fix the Express response headers?

**Fix applied:**
```js
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', 'attachment; filename="tasks-export.csv"');
```

**Error — Frontend Axios didn't trigger download:**
> The CSV endpoint works (Postman downloads it fine) but on the React frontend using Axios, the response data just gets stored in state and nothing downloads. How do I make Axios trigger a file download from a blob response?

**Fix applied:**
```js
const response = await api.get('/tasks/export-csv', { params: filters, responseType: 'blob' });
const blob = new Blob([response.data], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'tasks-export.csv';
a.click();
URL.revokeObjectURL(url);
```

---

## 9. Dashboard Aggregations & Recharts

### Prompt
> Build GET /api/dashboard endpoint. It must return:
> - openTasks: count of tasks where status is not DONE, scoped to projects the user can see
> - overdueTasks: count of tasks where dueDate < now AND status != DONE
> - dueThisWeek: count of tasks where dueDate is between today and end of this week AND status != DONE
> - completedThisWeek: count of tasks completed (status changed to DONE) in the last 7 days — use updatedAt as proxy
> - byStatus: array of { status, count } for all statuses
> - byAssignee: array of { userId, name, count } showing how many tasks each person is assigned to
> - weeklyCompletions: array of { week, count } for the last 8 weeks, showing how many tasks were completed (moved to DONE) each week
>
> Also build Dashboard.jsx React page with: 4 headline metric cards, a Recharts PieChart for byStatus, a Recharts BarChart for byAssignee, and a Recharts LineChart for weeklyCompletions.

### What you got
Complete dashboard route and React component with all charts.

### What you corrected

**Error — 8-week chart X-axis showed raw ISO dates:**
> The weeklyCompletions data from the backend returns dates like "2026-08-27T00:00:00.000Z" but I want the chart X-axis to show labels like "W-0", "W-1", "W-2" (relative weeks ago). Transform this on the frontend.

**Fix applied:** Added frontend week-label formatter:
```js
const now = new Date();
const weekLabel = (dateStr) => {
  const diff = now - new Date(dateStr);
  const weeksAgo = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  return weeksAgo === 0 ? 'This week' : `W-${weeksAgo}`;
};
```

**Error — "dueThisWeek" count included already overdue tasks:**
> The dueThisWeek metric is counting tasks that are already past their due date. I want it to only count tasks due from today forward, up to end of this week. Fix the Prisma where clause.

**Fix applied:** Added date bounds: `dueDate: { gte: startOfToday, lte: endOfWeek }`.

---

## 10. Overdue Alerts with Dismissal Reset

### Prompt
> Build the alerts system:
> - GET /api/alerts: Return all tasks where: dueDate < now AND status != DONE AND (the current user is assigned to the task) AND (either no AlertDismissal exists for this user+task, OR an AlertDismissal exists but dueDateAtDismissal is different from the current task.dueDate — meaning the due date changed after dismissal)
> - POST /api/alerts/:taskId/dismiss: Create or update AlertDismissal for the current user + task, storing the current task.dueDate as dueDateAtDismissal
> - Also add a count badge to the navigation: fetch GET /api/alerts, show the count. Update it automatically when alerts are dismissed.

### What you got
Alert routes and nav badge component.

### What you corrected

**Error — Dismissed alerts not re-appearing after due date change:**
> The alert dismissal works, but if I go back and change a task's due date, the alert does NOT re-appear. The current query uses `alerts: { none: { userId: req.user.id } }` which excludes ALL dismissed tasks regardless of whether the due date changed. Fix the query to re-surface alerts where the dismissal's dueDateAtDismissal doesn't match the current task.dueDate.

**Fix applied:** Changed the Prisma `where` clause to:
```js
{
  OR: [
    { alerts: { none: { userId: req.user.id } } },
    {
      alerts: {
        some: {
          userId: req.user.id,
          NOT: { dueDateAtDismissal: task.dueDate }
        }
      }
    }
  ]
}
```

**Error — Nav badge didn't update after dismissal:**
> When I dismiss an alert on the Alerts page, the count badge in the nav doesn't decrease until I refresh the page. How do I update the badge count without a full reload?

**Fix applied:** Added custom browser event dispatch:
```js
// In AlertsPage.jsx after successful dismiss:
window.dispatchEvent(new Event('alerts-updated'));

// In App.jsx:
window.addEventListener('alerts-updated', fetchAlertCount);
```

---

## 11. Seed Script & Demo Data

### Prompt
> Write a Prisma seed script at prisma/seed.js using ES Modules syntax. Create:
> - 1 manager user: email manager@test.com, password password123, role MANAGER, name Jane Manager
> - 3 member users: kumkum@test.com (password kum, name Kumkum Bharti), member2@test.com (password passwordcode, name Max Allen), member3@test.com (password password123, name Sarah Connor)
> - 2 projects: PROJ-1 (My First Project) and MOBILE-1 (Mobile App Redesign), both owned by the manager
> - Add all users as members to the relevant projects
> - Create 4 tasks per project with varied statuses (BACKLOG, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED), different priorities and due dates. Include at least 2 overdue tasks. Assign specific users to each task. Add TaskEvent rows for CREATED and STATUS_CHANGED events so the timeline is not empty.
> - Use upsert everywhere so the seed is idempotent (safe to run multiple times)
> - Wrap everything in async function main() with prisma.$disconnect() in finally block

### What you got
Complete idempotent `seed.js` with all users, projects, memberships, tasks, assignees, blockers, and events.

### What you corrected

**Error — seed.js crashed with "await is only valid in async functions":**
> The seed script crashes with: "SyntaxError: await is only valid in async functions and the top level bodies of modules". I have top-level await calls. How do I fix this?

**Fix applied:** Wrapped all code in `async function main() { ... }` and called `main().catch(console.error).finally(() => prisma.$disconnect())`.

**Error — Alerts page was empty for demo users:**
> After seeding, the alerts page shows zero alerts even though there are overdue tasks. Why?

**Root cause:** The seed created tasks with overdue due dates but did not create `TaskAssignee` rows, so no user was assigned to those tasks. Alerts only appear for tasks the current user is assigned to. **Fix:** Added `assignees: { create: [{ userId: kumkum.id }] }` to the overdue tasks in the seed.

---

## 12. Frontend: React Context, Routing & Axios Client

### Prompt
> Build the React frontend foundation:
> - src/api/client.js: Create an Axios instance with baseURL from import.meta.env.VITE_API_URL. Add a request interceptor that reads the JWT from localStorage (key: 'token') and attaches Authorization: Bearer <token> header if present. Add a response interceptor: if response status is 401, remove the token from localStorage and redirect to /login.
> - src/context/AuthContext.jsx: React context with { user, token, login(token, userData), logout() }. login() saves token to localStorage. logout() clears it. Parse the stored token on mount to restore session.
> - src/App.jsx: Set up React Router with routes: /login, /register, /dashboard, /projects, /projects/:id, /tasks, /alerts. Wrap protected routes in a component that redirects to /login if no token. Wrap all routes in an ErrorBoundary component.

### What you got
Complete client.js, AuthContext.jsx, and App.jsx with routing.

### What you corrected
- The 401 response interceptor was using `window.location.href = '/login'` which causes a full page reload and clears React state. Changed to `navigate('/login')` using React Router's `useNavigate` — but this required the interceptor to be defined inside a component that has access to the router. Solved by using a module-level variable to store the navigate function, set once on app mount.
- The `ErrorBoundary` was a class component (correct for React error boundaries) but was missing `getDerivedStateFromError`. Added it.
