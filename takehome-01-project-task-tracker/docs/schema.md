# Database Schema Specification

### Table by Table Definition

#### 1. `User`
- `id`: `Int` (Primary Key, Autoincrement)
- `email`: `String` (Unique)
- `passwordHash`: `String`
- `name`: `String`
- `role`: `Enum(MANAGER, MEMBER)` (Default: `MEMBER`)
- `createdAt`: `DateTime` (Default: `now()`)

#### 2. `Project`
- `id`: `Int` (Primary Key, Autoincrement)
- `key`: `String` (Unique)
- `name`: `String`
- `description`: `String?` (Optional)
- `isArchived`: `Boolean` (Default: `false`)
- `ownerId`: `Int` (Foreign Key -> `User.id`)
- `createdAt`: `DateTime` (Default: `now()`)
- `updatedAt`: `DateTime` (Updated automatically)

#### 3. `ProjectMember`
- `projectId`: `Int` (Foreign Key -> `Project.id`, Cascade Delete)
- `userId`: `Int` (Foreign Key -> `User.id`, Cascade Delete)
- `joinedAt`: `DateTime` (Default: `now()`)
- Composite Primary Key: `@@id([projectId, userId])`

#### 4. `Task`
- `id`: `Int` (Primary Key, Autoincrement)
- `title`: `String`
- `description`: `String?` (Optional)
- `priority`: `Enum(LOW, MEDIUM, HIGH, URGENT)` (Default: `MEDIUM`)
- `status`: `Enum(BACKLOG, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED)` (Default: `BACKLOG`)
- `blockedFrom`: `Enum(TaskStatus)?` (Optional: stores `IN_PROGRESS` or `IN_REVIEW`)
- `dueDate`: `DateTime?` (Optional)
- `projectId`: `Int` (Foreign Key -> `Project.id`, Cascade Delete)
- `createdById`: `Int` (Foreign Key -> `User.id`)
- `createdAt`: `DateTime` (Default: `now()`)
- `updatedAt`: `DateTime` (Updated automatically)

#### 5. `TaskAssignee`
- `taskId`: `Int` (Foreign Key -> `Task.id`, Cascade Delete)
- `userId`: `Int` (Foreign Key -> `User.id`, Cascade Delete)
- `assignedAt`: `DateTime` (Default: `now()`)
- Composite Primary Key: `@@id([taskId, userId])`

#### 6. `TaskBlocker`
- `blockedTaskId`: `Int` (Foreign Key -> `Task.id`, Cascade Delete)
- `blockingTaskId`: `Int` (Foreign Key -> `Task.id`, Cascade Delete)
- Composite Primary Key: `@@id([blockedTaskId, blockingTaskId])`

#### 7. `TaskEvent` (Immutable Audit Log)
- `id`: `Int` (Primary Key, Autoincrement)
- `eventType`: `String` (`CREATED`, `FIELD_CHANGED`, `STATUS_CHANGED`, `ASSIGNED`, `UNASSIGNED`, `COMMENT`)
- `fieldName`: `String?`
- `oldValue`: `String?`
- `newValue`: `String?`
- `commentText`: `String?`
- `taskId`: `Int` (Foreign Key -> `Task.id`, Cascade Delete)
- `actorId`: `Int` (Foreign Key -> `User.id`)
- `createdAt`: `DateTime` (Default: `now()`)

#### 8. `AlertDismissal`
- `id`: `Int` (Primary Key, Autoincrement)
- `taskId`: `Int` (Foreign Key -> `Task.id`, Cascade Delete)
- `userId`: `Int` (Foreign Key -> `User.id`, Cascade Delete)
- `dueDateAtDismissal`: `DateTime`
- `dismissedAt`: `DateTime` (Default: `now()`)
- Unique Constraint: `@@unique([taskId, userId])`

---

### Relationships Breakdown

- **One-to-Many Relationships**:
  - `User` (1) -> `Project` (Many, owned projects)
  - `User` (1) -> `Task` (Many, created tasks)
  - `User` (1) -> `TaskEvent` (Many, performed audit events)
  - `Project` (1) -> `Task` (Many)
  - `Task` (1) -> `TaskEvent` (Many)
- **Many-to-Many Relationships**:
  - `Project` <-> `User` (via `ProjectMember` join model)
  - `Task` <-> `User` (via `TaskAssignee` join model)
  - `Task` <-> `Task` (Self-referential dependencies via `TaskBlocker` join model)

---

### Constraint Enforcement: Database vs. Application Code

- **Enforced by Database**:
  - **Uniqueness**: `User.email`, `Project.key`, `AlertDismissal(taskId, userId)`.
  - **Foreign Key Referencing**: Cascading deletes (`onDelete: Cascade`) for `ProjectMember`, `TaskAssignee`, `TaskBlocker`, `TaskEvent`, and `AlertDismissal` when parent records are deleted.
  - **Enum Data Integrity**: `Role`, `TaskStatus`, and `Priority` values are enforced at the DB level.
- **Enforced by Application Code (`stateMachine.js` & API Routes)**:
  - **State Machine Transition Rules**: Rejecting direct jumps (e.g. `BACKLOG` -> `DONE`) or unblocking to an arbitrary state.
  - **Unfinished Blocker Check**: Requiring all `TaskBlocker` tasks to be `DONE` before completing a task.
  - **Project Member Assignment Requirement**: Verifying that a user belongs to `ProjectMember` before assigning them to a task in that project.
- **Why Draw the Line Here**:
  - Structural relationships, cascading cleanup, and data types belong in the database for ACID safety.
  - Business rules involving dynamic workflow checks, blocker statuses across multiple rows, and role logic are far easier to express, test, and report clear error messages for in application code.

---

### What Did You Deliberately Denormalise?

- `Task.blockedFrom`: Stores the exact enum string (`IN_PROGRESS` or `IN_REVIEW`) directly on the `Task` row rather than querying historical `TaskEvent` rows to figure out where a task was blocked from. This speeds up unblock transitions and status rendering significantly.

---

### What Would Break First If This Had 100x the Data?

1. **`TaskEvent` Table (Audit Log Volume)**:
   - At 100x scale, storing every single field change, comment, and assignment in a single table without partitioning or indexing strategy on `createdAt` would cause `GET /api/tasks/:id/timeline` and full table scans to slow down.
   - **Fix**: Range-partition `TaskEvent` by `createdAt` date or archive historical events.
2. **Global Task Search Count (`prisma.task.count`)**:
   - Running `count()` queries on non-indexed text searches across millions of rows on every search request will become heavy.
   - **Fix**: Implement PostgreSQL Full-Text Search (`tsvector` index) or Elasticsearch/Meilisearch.
3. **`TaskBlocker` Cycle Queries**:
   - The current blocker check is a single-hop check (does this task have unfinished blockers?). At 100x scale with deep dependency chains, cycle detection would require a recursive CTE query (`WITH RECURSIVE`), which on millions of rows without path-length limits could run indefinitely.
   - **Fix**: Limit dependency depth (e.g., max 5 hops) or implement topological sort at write time.
4. **`ProjectMember` Cascade Unassignment**:
   - When a member is removed from a project, all of their task assignments in that project are deleted via a looped Prisma `deleteMany`. At 100x scale with hundreds of tasks per project, this N+1 unassignment loop would cause latency spikes.
   - **Fix**: A single `DELETE FROM TaskAssignee WHERE userId = ? AND taskId IN (SELECT id FROM Task WHERE projectId = ?)` batch query.

---

### Entity-Relationship Diagram (Conceptual)

```
User ──────────────────────────────────────────────────────────────────┐
 │ (ownerId)                                                            │
 │  1                                                                   │
 │  ↓  many                                                             │
Project ──── (many-to-many via ProjectMember) ──── User               │
 │                                                                      │
 │  1                                                                   │
 │  ↓  many                                                             │
Task ─────── (many-to-many via TaskAssignee) ──── User                 │
 │                                                                      │
 │  (self-referential many-to-many via TaskBlocker)                     │
 │  Task ←── blocks ──→ Task                                            │
 │                                                                      │
 │  1                                                                   │
 │  ↓  many (append-only, never updated or deleted)                     │
TaskEvent ── actorId ──── User                                          │
                                                                        │
AlertDismissal ── taskId ──→ Task                                       │
               └─ userId ──→ User                                       │
```

---

### Index Strategy

The following indexes are explicitly defined in `schema.prisma` via `@@index` directives:

| Table | Indexed Column(s) | Reason |
|:------|:-----------------|:-------|
| `Project` | `ownerId` | Fast lookup of all projects owned by a manager. |
| `Task` | `projectId` | Core join on every project board fetch. |
| `Task` | `createdById` | Filtered task lookup by creator. |
| `Task` | `status` | Global task search filters heavily on status. |
| `TaskEvent` | `taskId` | Timeline query for a given task. |
| `TaskEvent` | `actorId` | Audit queries by user. |

**Uniqueness constraints** double as implicit indexes:
- `User.email` — prevents duplicate registrations and is used in login lookup.
- `Project.key` — prevents duplicate project keys (used as a short identifier in the UI).
- `AlertDismissal(taskId, userId)` — prevents a user dismissing the same task alert twice; enforces idempotent upsert behaviour.

---

### Why `blockedFrom` Is On `Task` Rather Than Derived From `TaskEvent`

This is the most important deliberate denormalization in the schema, worth explaining in depth.

**The alternative** (normalized approach): When a task is blocked, write a `TaskEvent` with `eventType: 'STATUS_CHANGED'`, `oldValue: 'IN_PROGRESS'`, `newValue: 'BLOCKED'`. When unblocking, query the most recent `STATUS_CHANGED` event with `newValue = 'BLOCKED'` to recover the `oldValue` (which was the state before blocking).

**Why this was rejected**: The unblock operation would require a subquery like:
```sql
SELECT oldValue FROM TaskEvent
WHERE taskId = ? AND eventType = 'STATUS_CHANGED' AND newValue = 'BLOCKED'
ORDER BY createdAt DESC LIMIT 1;
```
This query runs on every unblock, and if the task's timeline is long (many edits), it scans many rows. More critically, the logic is implicit — the state machine cannot be understood by reading the Task row alone. A reviewer reading the code would need to trace through `TaskEvent` history to understand where an unblock lands.

**The chosen approach**: Store `blockedFrom: TaskStatus?` directly on the `Task` row. It is set when transitioning to `BLOCKED` and cleared when transitioning away from `BLOCKED`. The state machine reads `task.blockedFrom` in a single column access. It is O(1), self-documenting, and testable without a database.

The trade-off is a tiny redundancy: `blockedFrom` is derivable from `TaskEvent` history. We accepted this because the gain in performance, readability, and testability vastly outweighs the minor normalization violation for a field that only holds two possible non-null values.
