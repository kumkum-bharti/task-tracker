# Decisions Log

This document records the architectural and technical decisions that shaped the BusyTracker codebase, including decisions that were later reversed due to real-world errors and development friction.

---

## Decision 1: Language and Runtime Environment

- **Chose**: Node.js + Express with Plain JavaScript (ES Modules).
- **Rejected**: TypeScript (`ts-node` / `tsc`).
- **Why**: Plain JS with ES Modules (`import`/`export`) provided maximum development speed without compilation overhead or type-definition friction. Prisma client still provided schema typing and query safety.

---

## Decision 2: State Machine and Authorization Enforcement

- **Chose**: Strict server-side state machine validation (`stateMachine.js`) and middleware checks (`requireManager`).
- **Rejected**: Client-side UI conditional checks alone.
- **Why**: Requirement 1 & 4 mandate that role differences (e.g. deleting tasks, managing members, archiving projects) and illegal task status jumps must be rejected by the server with explicit error messages, not just hidden in the UI.

---

## Decision 3: Audit Trail Data Architecture

- **Chose**: Unified, append-only `TaskEvent` table handling creation, field changes, status moves, assign/unassign, and comments.
- **Rejected**: Creating separate relational tables for comments, status history, and field diffs.
- **Why**: A single append-only timeline table guarantees a unified, chronological history feed per task (`GET /api/tasks/:id/timeline`) and makes enforcing strict immutability (no update/delete routes) trivial.

---

## Decision 4: Bulk Operations Execution Strategy

- **Chose**: Per-task evaluation with partial success reporting (`PATCH /api/tasks/bulk-update`).
- **Rejected**: All-or-nothing database transactions for bulk operations.
- **Why**: Requirement 7 specifies that if a user selects 5 tasks and applies a status move where 2 are illegal, the server must process the 3 valid tasks and return an explicit per-task report detailing what succeeded and what failed and why.

---

## Decision 5: Task Filtering and Search Location

- **Chose**: 100% Server-side search, filtering, sorting, and pagination via `GET /api/tasks`.
- **Rejected**: Client-side memory filtering of tasks loaded into browser state.
- **Why**: Requirement 6 mandates: *"All of this must be done by the server — do not load every task into the browser and filter there."*
- **Later reversed**: Initially, `ProjectBoard.jsx` fetched all tasks for a single project and filtered them using `useMemo` in React state for instant UI responsiveness. However, for global portfolio search across all projects (`TaskSearch.jsx`), we reversed client-side filtering and implemented full server-side Prisma database queries (`where`, `orderBy`, `skip`, `take`, `count`) to ensure scalability and strict adherence to Requirement 6.

---

## Decision 6: API Client Target Port Configuration

- **Chose**: Aligning `api/client.js` base URL to `http://localhost:3000/api`.
- **Rejected**: Defaulting to port `5000`.
- **Why**: Initially, the Axios client defaulted to port 5000. During initial login tests, the browser threw `net::ERR_CONNECTION_REFUSED` because the Express backend was listening on port 3000.
- **Later reversed**: We updated `client.js` and `.env.example` to target port 3000, immediately resolving the connection errors.

---

## Decision 7: Prisma Deletion Strategy for Composite Keys (`delete` vs `deleteMany`)

- **Chose**: Using `prisma.taskAssignee.deleteMany({ where: { taskId, userId } })`.
- **Rejected**: Using `prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } })`.
- **Why**: Initially, we used Prisma's single `.delete()` method to unassign users from tasks.
- **Later reversed**: When unassigning a user from a task, the API endpoint threw a `500 Internal Server Error` due to Prisma throwing a record-not-found exception (P2025). We reversed this by switching to `.deleteMany()`, which executes safely without throwing 500 exceptions if a record key mismatch occurs.

---

## Decision 8: Task Assignment UX in Modals

- **Chose**: Adding an explicit **"Assign Member"** submit button next to the project member select dropdown in `TaskDetailModal.jsx`.
- **Rejected**: Auto-submitting assignments immediately on the select element's `onChange` event.
- **Why**: Initially, selecting a user from the dropdown auto-triggered assignment.
- **Later reversed**: Users reported confusion about how to submit their choice ("there is no submit button after selecting assignees") and experienced accidental assignment triggers. We reversed auto-submission and added an explicit primary submit button requiring deliberate user action.

---

## Decision 9: Asynchronous Modal State Synchronization

- **Chose**: Functional state updates (`setSelectedTask(prev => ...)`) and wrapping protected routes in a React `ErrorBoundary.jsx`.
- **Rejected**: Accessing outer `selectedTask` closure variables during asynchronous data fetches.
- **Why**: When assignees were added or removed, `fetchProjectData()` re-fetched tasks, but because `selectedTask` was captured in stale closures, property access on null objects threw an uncaught error in `<ProjectBoard>`, crashing the React component tree.
- **Later reversed**: We reversed direct state access in favor of functional updater hooks and optional chaining (`a.user?.name || 'Unknown'`), and wrapped all routes in an `ErrorBoundary` component to guarantee UI stability.
