# Story 5.3: Remove Debug Panels from Right Sidebar

Status: done

## Story

As a user,
I want a cleaner UI without System Status and Worker Logs visible,
So that the interface focuses on DJ functionality rather than debug information.

## Acceptance Criteria

1. **Remove System Status Panel:** Given the current App.tsx, when this story is complete, then the System Status `<details>` block must be removed from the JSX (if present).

2. **Remove Worker Logs Panel:** The Worker Logs `<details>` block must be removed from the JSX (if present).

3. **Redirect Logs to Console:** All log messages currently going to `setLogs()` must be redirected to `console.debug()` instead of accumulating in React state.

4. **Console Init Logging:** The heartbeat and dbInfo status should be logged to console on initialization for debugging purposes.

5. **Remove Dead Code:** All unused state variables (`logs`, `status`, `dbStatus`, `heartbeat`, `dbInfo`) and their setters must be removed since they're no longer rendered.

6. **Layout Adjustment:** The layout must utilize the full available space (DeckUI already integrated into LibraryWaveform in Story 5.2).

## Tasks / Subtasks

- [x] **Task 1: Remove Unused State Variables** (AC: 5)
  - [x] Remove `const [status, setStatus]` - not rendered anywhere
  - [x] Remove `const [dbStatus, setDbStatus]` - not rendered anywhere
  - [x] Remove `const [heartbeat, setHeartbeat]` - not rendered anywhere
  - [x] Remove `const [dbInfo, setDbInfo]` - not rendered anywhere
  - [x] Remove `const [logs, setLogs]` - not rendered anywhere

- [x] **Task 2: Replace setLogs with console.debug** (AC: 3, 4)
  - [x] In kernel handler: replace `setLogs(prev => [...prev, ...])`  with `console.debug(...)`
  - [x] In init function: replace all `setLogs()` calls with `console.debug()`
  - [x] Log heartbeat result to console: `console.debug('Heartbeat:', heartbeatMessage)`
  - [x] Log dbInfo to console: `console.debug('Database:', dbInfoMessage)`

- [x] **Task 3: Simplify Init Logic** (AC: 3, 4)
  - [x] Remove status state tracking (not displayed)
  - [x] Keep error logging to `console.error()` for actual errors
  - [x] Simplify success paths to just console logging

- [x] **Task 4: Verify Layout** (AC: 6)
  - [x] Confirm LibraryView uses full available space
  - [x] No visual regressions after cleanup

- [x] **Task 5: Testing** (AC: all)
  - [x] Verify app loads correctly without console errors
  - [x] Verify kernel initialization still works
  - [x] Verify database health check still passes
  - [x] Check browser console shows debug messages on init

## Dev Notes

### Critical Files

**Files to Modify:**
```
src/App.tsx  # Remove unused state and redirect logging
```

### Current State Analysis

The App.tsx currently has:

1. **Unused State Variables (lines 9-13):**
```typescript
const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
const [dbStatus, setDbStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
const [heartbeat, setHeartbeat] = useState<string | null>(null);
const [dbInfo, setDbInfo] = useState<string | null>(null);
const [logs, setLogs] = useState<string[]>([]);
```

2. **setLogs Calls to Replace:**
- Line 19: `setLogs(prev => [...prev, \`[Worker Event] ${msg.type}: ...\`])`
- Line 44: `setLogs(prev => [...prev, '[UI] Waiting for Database Worker...'])`
- Line 49: `setLogs(prev => [...prev, '[UI] Performing DB Health Check...'])`
- Line 58: `setLogs(prev => [...prev, '[UI] Database Health Check PASSED'])`
- Line 62: `setLogs(prev => [...prev, \`[UI] DB ERROR: ${error.message}\`])`

3. **Status Updates to Remove:**
- Line 24: `setStatus('connected')` - dead code
- Line 39: `setStatus('error')` - dead code

### Target Implementation

```typescript
import { useEffect } from 'react';
import { kernel } from './shared/kernel/kernel-manager';
import { EventType } from './shared/types/messaging';
import { LibraryView } from './modules/library/LibraryView';
import { ModalProvider } from './shared/components/modals/ModalProvider';
import { ToastContainer } from './shared/components/Toast';

function App() {
  useEffect(() => {
    const unsubscribe = kernel.addHandler((msg) => {
      // Log worker events for debugging (except high-frequency messages)
      if (msg.type !== EventType.PONG && msg.type !== EventType.DB_QUERY_RESPONSE) {
        console.debug(`[Worker Event] ${msg.type}:`, msg.payload || '');
      }
    });

    const init = async () => {
      // 1. Heartbeat test
      try {
        console.debug('[UI] Testing kernel heartbeat...');
        const response = await kernel.send(EventType.PING, { message: 'Hello from UI' });
        console.debug('[UI] Heartbeat Success:', response.message, `(Worker started at ${new Date(response.workerStartTime).toLocaleTimeString()})`);
      } catch (error) {
        console.error('[UI] Heartbeat Failed:', error);
      }

      // 2. Database Initialization
      try {
        console.debug('[UI] Waiting for Database Worker...');
        await kernel.waitFor(EventType.DB_READY);

        console.debug('[UI] Performing DB Health Check...');
        const versionResult = await kernel.send(EventType.DB_QUERY_REQUEST, {
          sql: 'SELECT sqlite_version() as version',
          method: 'get',
          targetDb: 'm'
        });

        console.debug('[UI] Database Health Check PASSED - SQLite Version:', versionResult.version);
      } catch (error: any) {
        console.error('[UI] Database Init Failed:', error);
      }
    };

    init();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] text-[#4DFA90] font-sans p-8 flex flex-col">
      <ModalProvider />
      <ToastContainer />

      <main className="flex-1 min-h-0">
        <LibraryView />
      </main>

      <footer className="mt-auto text-[10px] opacity-40 uppercase tracking-[0.2em]">
        Split-Brain Actor Model | React 19 | Vite | SQLite WASM | OPFS
      </footer>
    </div>
  );
}

export default App;
```

### Key Changes Summary

1. **Removed 5 useState hooks** - none were being rendered
2. **Replaced setLogs() with console.debug()** - preserves debugging capability
3. **Kept console.error() for actual errors** - important for debugging
4. **Removed setStatus/setDbStatus calls** - no longer tracked
5. **Simplified heartbeat/dbInfo to immediate console logging**

### Previous Story Intelligence

**From Story 5.1:**
- ImportControl panel was removed, context menu import added
- Toast system was enhanced with persistent toast support

**From Story 5.2:**
- LibraryWaveform now contains the full deck functionality (moved from DeckUI)
- DeckUI.tsx was deleted
- Layout is already full-width with LibraryView taking all available space
- Hot cues are on one line (grid-cols-8)
- Track info is displayed next to deckId in header

### Dependencies

None - this is a cleanup task removing dead code.

### Edge Cases

1. **Console spam:** The debug logging is filtered to exclude PONG and DB_QUERY_RESPONSE (high-frequency messages)
2. **Error visibility:** Errors still go to console.error() so they remain visible
3. **Production builds:** console.debug is typically stripped or silent in production

### References

- [Source: src/App.tsx] - Target file for cleanup
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3] - Original requirements
- [Source: _bmad-output/implementation-artifacts/5-2-relocate-waveform-ui-above-track-list.md] - Previous story context

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build verification: TypeScript compilation successful for App.tsx changes
- Unit tests: 270 tests passed, no regressions

### Completion Notes List

- **Task 1:** Removed 5 unused useState hooks (`status`, `dbStatus`, `heartbeat`, `dbInfo`, `logs`) from App.tsx. Changed import from `import { useEffect, useState }` to `import { useEffect }`.

- **Task 2:** Replaced all `setLogs()` calls with `console.debug()`:
  - Kernel handler: Now logs worker events with `console.debug('[Worker Event]', msg.type, msg.payload)`
  - Init heartbeat: `console.debug('[UI] Heartbeat Success:', ...)`
  - Init database: `console.debug('[UI] Waiting for Database Worker...')`, `console.debug('[UI] Database Health Check PASSED - SQLite Version:', ...)`

- **Task 3:** Simplified init logic by removing `setStatus()` and `setDbStatus()` calls. Errors still go to `console.error()` for visibility. Success paths simplified to immediate console logging.

- **Task 4:** Layout verified - LibraryView already uses full available space (no changes needed to JSX structure).

- **Task 5:** All 270 unit tests pass. App compiles successfully. Debug logging preserved for developer visibility.

### File List

**Modified:**
- src/App.tsx (removed 5 useState hooks, replaced setLogs with console.debug, simplified init)

### Change Log

- 2026-01-16: Implemented Story 5.3 - Removed all debug state variables and replaced setLogs() calls with console.debug(). App.tsx reduced from 89 lines to 68 lines. All 270 unit tests pass.
- 2026-01-16: Code Review fixes applied - Fixed `error: any` typing, fixed footer formatting.

## Senior Developer Review (AI)

**Review Date:** 2026-01-16
**Reviewer:** Claude Opus 4.5 (adversarial code review)
**Outcome:** ✅ APPROVED (after fixes)

### Issues Found and Fixed

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| M1 | MEDIUM | `error: any` violates strict typing at line 40 | Fixed: Changed to `catch (error)` with `instanceof Error` type narrowing |
| L1 | LOW | Footer formatting artifact with extra whitespace | Fixed: Proper line breaks in JSX |
| L2 | LOW | Line count inaccuracy in completion notes | Acknowledged: Actual is 68 lines |

### Verification

- **Lint:** ✅ App.tsx passes ESLint (no errors in target file)
- **Tests:** ✅ 270 unit tests pass
- **All ACs:** ✅ Implemented and verified
