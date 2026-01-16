# Test Design: Epic 1 - The Librarian (Ingest & Organization)

**Epic**: 1
**Scope**: Full Epic
**Focus**: Database Integrity, Kernel Performance, Large-Scale Ingestion

---

## 1. Risk Assessment Matrix

The "Split-Brain" architecture and local-first database introduce unique risks around data consistency and thread synchronization.

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation Strategy |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **R-101** | **DATA** | **Database Corruption on OPFS**: Improper worker termination or concurrent access handle locks leading to `m.db` corruption. | 2 (Possible) | 3 (Critical) | **6** | Implement WAL mode and transactional integrity tests with simulated crashes. |
| **R-102** | **PERF** | **Message Bus Jitter**: Latency in `WorkerMessage` correlation causing UI lag >16ms during heavy DB ingestion. | 2 (Possible) | 3 (Critical) | **6** | Heartbeat monitoring and SAB status plane validation. |
| **R-103** | **PERF** | **Ingestion Scale Bottleneck**: Memory exhaustion or UI freezing when scanning 50,000+ tracks via File System Access API. | 3 (Likely) | 2 (Degraded) | **6** | Stress tests with mock file systems; batch processing validation. |
| **R-104** | **DATA** | **Playlist Tree Integrity**: Broken linked-list pointers (`nextEntityId`) causing orphaned tracks or circular references in crates. | 2 (Possible) | 3 (Critical) | **6** | Recursive tree validation tests; boundary condition checks for D&D. |
| **R-105** | **PERF** | **FTS5 Query Latency**: Full-Text Search taking >50ms on large libraries, breaking the "Type-Ahead" experience. | 2 (Possible) | 2 (Degraded) | 4 | Performance benchmarking for SQLite FTS5 extension under load. |
| **R-106** | **SEC** | **File System Escape**: Maliciously crafted file paths or symlinks attempting to access files outside the user-selected root. | 1 (Unlikely) | 3 (Critical) | 3 | Sandbox validation for File System Access API handles. |

---

## 2. Test Coverage Plan

We will prioritize **Integration** tests for the Kernel/Database interactions and **E2E** tests for user-facing workflows. Unit tests focus on complex logic like tree management.

### P0 - Critical Scenarios (Must Pass)

| ID | Story | Test Level | Scenario | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **1.1-INT-001** | 1.1 | Integration | **Worker Kernel Ping/Pong** | Validate message bus latency is <16ms and UUIDs correlate correctly. (R-102) |
| **1.2-INT-001** | 1.2 | Integration | **Atomic DB Writes (WAL)** | Verify data persists after immediate worker termination (crash simulation). (R-101) |
| **1.2-INT-002** | 1.2 | Integration | **Schema Compatibility** | Verify generated `m.db` matches exact Engine DJ schema definition. |
| **1.5-UNIT-001** | 1.5 | Unit | **Linked List Reorder** | Validate `nextEntityId` pointer logic when moving tracks in a playlist. (R-104) |
| **1.3-E2E-001** | 1.3 | E2E | **Folder Ingest Flow** | User selects folder -> UI updates -> Tracks appear in DB. |

### P1 - High Priority (Should Pass)

| ID | Story | Test Level | Scenario | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **1.3-INT-002** | 1.3 | Integration | **Large Scale Ingest** | Mock ingest of 10,000 files; verify no memory leaks and completion time. (R-103) |
| **1.6-INT-001** | 1.6 | Integration | **FTS Latency** | Measure query time for single-char input on 10k track DB (<50ms). (R-105) |
| **1.4-E2E-001** | 1.4 | E2E | **Virtualized Scroll** | Validate 60fps frame rate during rapid scrolling of track list. |
| **1.7-UNIT-001** | 1.7 | Unit | **Smartlist Query Gen** | Validate complex AND/OR logic translates to correct SQL WHERE clauses. |

### P2 - Medium Priority (Nice to Have)

| ID | Story | Test Level | Scenario | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **1.5-E2E-001** | 1.5 | E2E | **Playlist Drag-Drop** | Visual validation of drag-and-drop reordering in the tree view. |
| **1.6-E2E-001** | 1.6 | E2E | **Type-Ahead UI** | Validate focus handling and keyboard shortcuts for search. |

---

## 3. Execution Order

1.  **Smoke Tests (CI)**: `1.1-INT-001`, `1.2-INT-001` (Kernel & DB health).
2.  **P0 Critical Path**: Ingestion flow and Data Integrity checks.
3.  **P1 Performance**: Scale tests and FTS latency benchmarks.
4.  **P2 UI Interaction**: Drag-and-drop and complex UI state.

---

## 4. Resource Estimates

-   **P0 Scenarios**: 5 tests × 2 hours = 10 hours
-   **P1 Scenarios**: 4 tests × 3 hours = 12 hours (includes performance profiling setup)
-   **P2 Scenarios**: 2 tests × 1 hour = 2 hours
-   **Total Effort**: ~24 hours (3 days)

---

## 5. Quality Gate Criteria

To mark Epic 1 as "Done", we must demonstrate:

-   **0 Data Corruption**: 100% pass rate on DB integrity and crash recovery tests.
-   **Performance**: Ingestion does not block the main thread (UI remains responsive).
-   **Latency**: Kernel message round-trip <16ms (one frame).
-   **Scale**: Capable of handling 10,000+ tracks in the mock database without crashing.

---

## 6. Recommendations for Implementation

1.  **Start with the Kernel**: Implement the `SharedWorker` and message bus first. Use `1.1-INT-001` to TDD this.
2.  **Mock the File System**: Do not rely on real files for scale testing. Create a virtual file system generator for the 10k track test.
3.  **Use `sqlite-wasm` carefully**: Ensure the OPFS build is used, not the memory-only fallback, for valid persistence testing.
