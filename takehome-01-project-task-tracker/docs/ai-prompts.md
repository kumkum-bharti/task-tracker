# AI Prompts Log

This document records the AI prompts used throughout the development of BusyTracker, grouped by development goals, showing the prompt, what was generated, and what corrections were required.

---

## 1. Authentication, Roles & Database Setup

### Prompt
> Create the database schema in Prisma and setting up Express authentication routes. Users must sign in with email and password, with roles `MANAGER` and `MEMBER`. Express JWT middleware must enforce server-side role security.

### What you got
Generated `schema.prisma` with User, Project, ProjectMember, Task, TaskAssignee, TaskBlocker, TaskEvent, and AlertDismissal models, along with `auth.js` middleware providing `authenticate` and `requireManager`.

### What you corrected
Adjusted `schema.prisma` to include `@relation(onDelete: Cascade)` for cascading removals when a member is removed from a project, ensuring task assignments are cleaned up automatically.

---

## 2. Task State Machine & Audit Logger

### Prompt
> Implement `src/lib/stateMachine.js` for legal transitions: `BACKLOG -> IN_PROGRESS -> IN_REVIEW -> DONE`, `BLOCKED` (remembering `blockedFrom`), and `DONE -> IN_PROGRESS`. Create `src/lib/auditLogger.js` to log immutable `TaskEvent` records.

### What you got
Solid state machine validator `validateTransition(from, to, blockedFrom)` and audit logging helper functions.

### What you corrected
Refined `validateTransition` to strictly enforce that unblocking a `BLOCKED` task can ONLY return to `blockedFrom` (e.g. `IN_PROGRESS` or `IN_REVIEW`), preventing arbitrary jumps during unblock actions.

---

## 3. Tasks CRUD & Server-Side Search

### Prompt
> Build `src/routes/tasks.js` for task CRUD, assignee management, and `GET /api/tasks` server-side search/filter/sort/pagination.

### What you got
Complete route handlers. `GET /api/tasks` built dynamic Prisma `where` clauses and returned `{ tasks, total, page, totalPages }`.

### What you corrected
Enhanced the `include` block in `GET /api/tasks` to include `project.key`, `project.id`, and `assignees.user` fields needed by the frontend table view and detail modals.

---

## 4. Bulk Operations & Filtered CSV Export

### Prompt
> Build `src/routes/bulk.js` with `PATCH /api/tasks/bulk-update` to handle batch status, assignee, and due date changes with per-task success/failure reporting, plus `GET /api/tasks/export-csv` to stream filtered search results to CSV.

### What you got
Unified bulk route. It iterates over task IDs, applies validation per task, updates valid tasks inside a transaction, and returns `{ updatedCount, updatedIds, failed: [{ id, title, reason }] }`.

### What you corrected
Added handling for `json2csv` parser headers so the browser triggers an immediate file download rather than returning raw text.

---

## 5. Frontend & UI Integration (With Correction Example)

### Prompt
> Build `TaskDetailModal.jsx` to allow assigning and unassigning project members to a task.

### What you got
An initial version of `TaskDetailModal.jsx` with a member dropdown and unassign `×` buttons.

### What produced something wrong & What you corrected
- **The Issue**: Unassigning a user triggered `DELETE /api/tasks/:id/assignees/:userId`, which threw `500 Internal Server Error`. Additionally, adding an assignee caused a React DOM tree crash in `<ProjectBoard>` due to `a.user.name` property dereferencing on null objects.
- **The Fix**:
  1. Updated `backend/src/routes/tasks.js` to use `prisma.taskAssignee.deleteMany({ where: { taskId, userId } })` instead of `delete()`, making unassignments safe against missing composite key exceptions.
  2. Updated `TaskCard.jsx` and `ProjectBoard.jsx` with optional chaining (`a.user?.name || 'Unknown'`) and functional state setters (`setSelectedTask(prev => ...)`).
  3. Added an explicit **"Assign Member"** submit button to the dropdown for clear UX.

---

## 6. Dashboard Aggregations & Recharts

### Prompt
> Build `GET /api/dashboard` to return: total open tasks, overdue tasks, tasks due this week, completed this week, breakdown by status, breakdown by assignee, and weekly completions for the last 8 weeks. Also build `Dashboard.jsx` with Recharts charts for status distribution (pie), assignee workload (bar), and 8-week completions trend (line).

### What you got
A complete dashboard route with Prisma aggregation queries grouped by `status`, `createdAt` (weekly bucketing), and `assignees.userId`. The frontend rendered a PieChart for status distribution and a BarChart for assignee workload.

### What you corrected
- **Issue**: The 8-week completions query returned raw `DateTime` strings. Recharts expected numeric week labels like `"Week 1"`, `"Week 2"` for the X-axis. The AI generated a backend-side `toISOString().slice(0, 10)` date label which was not human-readable in the chart.
- **Fix**: Moved the week-label formatting to the frontend — computed relative week number from the current date: `Math.floor((now - date) / (7 * 24 * 60 * 60 * 1000))` and displayed it as `"W-N"` (e.g., `"W-0"` = current week, `"W-1"` = last week).
- **Issue 2**: The "due this week" count was counting tasks due before today that had not been completed (i.e., already overdue), inflating the "due this week" number. Added `dueDate: { gte: startOfToday, lte: endOfWeek }` bounds to exclude already-overdue tasks.

---

## 7. Alert Dismissal & Due Date Reset Logic

### Prompt
> Build `GET /api/alerts` to return overdue tasks assigned to the current user that have not been dismissed, or have been dismissed but the task's due date has since changed. Build `POST /api/alerts/:taskId/dismiss` to record a dismissal.

### What you got
An alert route that queried tasks past their due date filtered to the user's assignments, with a join on `AlertDismissal`.

### What produced something wrong & What you corrected
- **The Issue**: The initial query used `NOT IN (SELECT taskId FROM AlertDismissal WHERE userId = ?)` which excluded ALL dismissed tasks, even those whose due date had changed — breaking the "alert re-appears on due date change" requirement.
- **The Fix**: Changed the query logic to include dismissed tasks where `dueDateAtDismissal != task.dueDate`. The `AlertDismissal` table stores `dueDateAtDismissal` at dismissal time for exactly this comparison. The corrected Prisma query used:
  ```js
  where: {
    OR: [
      { alerts: { none: { userId: req.user.id } } },
      { alerts: { some: { userId: req.user.id, dueDateAtDismissal: { not: task.dueDate } } } }
    ]
  }
  ```
  This is the correct self-contained approach that requires no coupling with other routes.

---

## 8. CSV Export

### Prompt
> Build `GET /api/tasks/export-csv` that accepts the same filter parameters as `GET /api/tasks` but returns a CSV file download instead of JSON, using the `json2csv` library.

### What you got
A route handler that built the same Prisma `where` clause as the task search, fetched all matching tasks, and passed them to `json2csv`'s `Parser`.

### What you corrected
- **Issue**: The response was returned with `Content-Type: application/json` by default, so the browser rendered the CSV as raw text rather than triggering a file download.
- **Fix**: Added explicit headers:
  ```js
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks-export.csv"');
  ```
  The `Content-Disposition: attachment` header instructs the browser to download the file rather than render it. The Axios client on the frontend was updated to handle the blob response type and create a temporary anchor element to trigger the download:
  ```js
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks-export.csv';
  a.click();
  ```

---

## 9. Overdue Alert Badge in Navigation

### Prompt
> Add an alert count badge to the main navigation that shows the number of unread overdue alerts for the current user. It should update automatically when the user dismisses an alert.

### What you got
A nav badge rendering `alertCount` from a `useState` variable, with a `fetchAlertCount()` function calling `GET /api/alerts`.

### What produced something wrong & What you corrected
- **Issue**: The badge count did not update after a user dismissed an alert on the Alerts page. The `alertCount` state lived in `App.jsx` but the dismiss action happened inside `AlertsPage.jsx`. There was no mechanism to tell `App.jsx` to refetch the count after a dismissal.
- **Fix**: Used the same `window.dispatchEvent(new Event('alerts-updated'))` pattern used for task updates. `App.jsx` listens for `'alerts-updated'` and calls `fetchAlertCount()` in response. `AlertsPage.jsx` dispatches the event after a successful dismissal. The badge count updates immediately without a full page reload.

---

## 10. Seeding Demo Data

### Prompt
> Write a Prisma seed script (`prisma/seed.js`) that creates 2 manager accounts, 3 member accounts, 3 projects with realistic names, project memberships, and 15–20 tasks across different statuses, priorities, and due dates, including some overdue tasks.

### What you got
A complete `seed.js` using `prisma.user.upsert`, `prisma.project.upsert`, and nested `prisma.task.create` calls.

### What you corrected
- **Issue**: The seed script created tasks but did not assign any `TaskAssignee` rows, meaning the "My Tasks" view and overdue alerts were empty for all demo users (since alerts only show for assigned users).
- **Fix**: Added `assignees: { create: [{ userId: memberId }] }` inside each task creation block, connecting tasks to specific member accounts. Also added `TaskEvent` seed rows with `eventType: 'CREATED'` so the timeline view was not empty on the demo.
- **Issue 2**: Prisma's `bcryptjs` hash was called with `await bcrypt.hash(password, 10)` in the seed file, but the seed script was run with `node` which requires the `--experimental-vm-modules` flag or a top-level async wrapper. The seed crashed with `SyntaxError: await is only valid in async functions`.
- **Fix**: Wrapped the entire seed in `async function main() { ... } main().catch(console.error)` with a `finally { await prisma.$disconnect() }` block — the standard Prisma seed pattern.
