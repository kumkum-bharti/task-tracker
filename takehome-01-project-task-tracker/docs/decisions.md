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

---

## Decision 10: How to Store the "Blocked From" State — A Chain of Failures

This decision is worth documenting in detail because it shows how one small wrong assumption caused a cascade of downstream bugs.

**The original plan**: When a task is blocked, we would derive where it came from by querying its `TaskEvent` history — specifically, find the most recent `STATUS_CHANGED` event where `newValue = 'BLOCKED'` and read the `oldValue` to know where to return on unblock.

**Why it seemed correct at first**: It felt elegant — the event log already stores every status transition, so querying it for unblock recovery seemed like avoiding redundancy.

**Failure #1 — The unblock query returned wrong results**: During testing, blocking a task that had already been blocked and unblocked before caused the history query to return the *oldest* block event instead of the most recent one, because the `ORDER BY createdAt DESC LIMIT 1` was accidentally omitted in the first iteration of the query. Tasks that had been cycled through BLOCKED → IN_PROGRESS → BLOCKED again would unblock to the wrong state entirely.

**Failure #2 — Led to a cascade of downstream state machine bugs**: Because `validateTransition` was reading the wrong `blockedFrom` value from the history query, the state machine began allowing illegal unblock transitions (e.g., returning a task to `IN_REVIEW` when it should have gone to `IN_PROGRESS`). This silently corrupted task state for a few test records before being noticed.

**Failure #3 — Made bulk unblock operations racy**: In the bulk update handler, unblocking multiple BLOCKED tasks concurrently required running the history query for each task inside a loop. Because Prisma queries are async and were being awaited sequentially, the handler was slow — and any concurrent update to a task's history during the loop could cause a race condition.

**The reversal**: Abandoned the derived-from-history approach entirely. Added a `blockedFrom: TaskStatus?` column directly to the `Task` table. Set it explicitly when transitioning to BLOCKED, clear it when leaving BLOCKED. The state machine now reads `task.blockedFrom` in O(1) with zero DB overhead. The bulk handler became trivially parallelizable.

**Lesson documented**: Deriving mutable state from an append-only log sounds correct in theory but introduces hidden ordering dependencies and N+1 query problems. Storing it as a direct field trades a small normalization violation for dramatically simpler, faster, and more correct code.

---

## Decision 11: Alert Dismissal Reset Mechanism

**The question**: When a user dismisses an overdue alert, and then the task's due date changes, should the alert reappear?

**The naive approach considered first**: Delete the `AlertDismissal` record when the task's due date is updated. This way, a fresh alert would appear on the next alert fetch.

**Why this was rejected**: Deletion-based reset requires that every place in the API that touches `Task.dueDate` also explicitly deletes the matching `AlertDismissal`. This creates a hidden coupling — a future developer adding a new route that updates due dates would break the alert system silently by forgetting to delete the dismissal.

**The chosen approach**: Keep the `AlertDismissal` row, but store `dueDateAtDismissal` (the due date value at the time of dismissal). The alert query does not just check if a dismissal exists — it checks `AlertDismissal.dueDateAtDismissal != Task.dueDate`. If they differ, the dismissal is treated as stale and the alert is included in the results.

This approach is self-contained within the alert query. No other route needs to know about alert dismissals. The data model carries the full context needed to make the correct decision.

---

## Decision 12: JWT in localStorage vs. HttpOnly Cookie

**Chose**: Storing the JWT in `localStorage` and injecting it via Axios request interceptor.

**Rejected**: Storing the JWT in an `HttpOnly` cookie and relying on browser automatic cookie attachment.

**Why localStorage was chosen for this project**:
- The assignment does not have a same-domain frontend/backend deployment (Vercel + Render are different origins), which makes cookie-based auth require `SameSite=None; Secure` configuration plus proper CORS `credentials: true` handling on both sides.
- For a timed assessment with a free-tier multi-origin deployment, localStorage eliminates cross-origin credential complexity entirely.

**The acknowledged trade-off**: localStorage is vulnerable to XSS attacks in a way that HttpOnly cookies are not. In a production system handling real user data, we would use HttpOnly cookies with CSRF token protection. For this internal tool prototype on a closed deployment, the XSS risk is accepted and documented.

---

## Decision 13: Framework and UI Library Selection

**Chose**: React 19 (with hooks) + plain CSS variables. No UI component library.

**Rejected**: Next.js (SSR framework), Shadcn/UI or MUI component libraries.

**Why plain React + CSS**:
- The assignment emphasises building ten specific features solidly, not demonstrating framework knowledge. A simpler stack means fewer abstractions to fight.
- Next.js Server-Side Rendering would complicate the API client pattern (Axios instances with interceptors behave differently in SSR context), adding setup time with no spec-mandated benefit since SEO is not a requirement.
- A component library (MUI, Shadcn) would have accelerated early UI work but introduces opinionated theming systems that slow down custom design work. The Slate/Sky-Blue dark theme was built once as a CSS variable system and applied consistently throughout.

**Later observation**: This decision held up well. The CSS variable system (`--bg-primary`, `--text-primary`, etc.) allowed full dark mode to be implemented in a single media query override with no component-level changes.

---

## Summary: Decision Chain Map

The following decisions were causally linked — each failure pushed the next decision:

```
Early Decision: Derive blockedFrom from TaskEvent history
        ↓ Failure: Wrong ordering returned stale block event
        ↓ Failure: State machine allowed illegal unblock transitions
        ↓ Failure: Bulk operations became racy with N+1 async queries
        ↓ Reversal: Added blockedFrom column directly to Task
        ✓ Fixed: O(1) lookup, correct state, safe bulk ops

Early Decision: Auto-submit assignment on dropdown onChange
        ↓ Failure: Users triggered accidental assignments
        ↓ Failure: Missing feedback caused confusion ("did it save?")
        ↓ Reversal: Added explicit "Assign Member" submit button
        ✓ Fixed: Clear UX, deliberate user intent

Early Decision: Use Prisma .delete() for composite key unassignment
        ↓ Failure: P2025 record-not-found exception on mismatch
        ↓ Reversal: Switched to .deleteMany() which is safe on 0 matches
        ✓ Fixed: No 500 errors on unassignment edge cases

Early Decision: Client-side filter in ProjectBoard for task display
        ↓ Not a failure locally (fast with few tasks)
        ↓ Recognized as non-compliant with Requirement 6 for global search
        ↓ Reversal: Global search uses 100% server-side Prisma queries
        ✓ Fixed: Compliant, scalable, spec-correct
```
