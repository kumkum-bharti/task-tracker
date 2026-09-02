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
