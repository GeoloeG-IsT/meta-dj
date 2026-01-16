# Story 5.3: Remove Debug Panels from Right Sidebar

Status: review

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

- [ ] **Task 1: Remove Unused State Variables** (AC: 5)
  - [ ] Remove `const [status, setStatus]` - not rendered anywhere
  - [ ] Remove `const [dbStatus, setDbStatus]` - not rendered anywhere
  - [ ] Remove `const [heartbeat, setHeartbeat]` - not rendered anywhere
  - [ ] Remove `const [dbInfo, setDbInfo]` - not rendered anywhere
  - [ ] Remove `const [logs, setLogs]` - not rendered anywhere

- [ ] **Task 2: Replace setLogs with console.debug** (AC: 3, 4)
  - [ ] In kernel handler: replace `setLogs(prev => [...prev, ...])`  with `console.debug(...)`
  - [ ] In init function: replace all `setLogs()` calls with `console.debug()`
  - [ ] Log heartbeat result to console: `console.debug('Heartbeat:', heartbeatMessage)`
  - [ ] Log dbInfo to console: `console.debug('Database:', dbInfoMessage)`

- [ ] **Task 3: Simplify Init Logic** (AC: 3, 4)
  - [ ] Remove status state tracking (not displayed)
  - [ ] Keep error logging to `console.error()` for actual errors
  - [ ] Simplify success paths to just console logging

- [ ] **Task 4: Verify Layout** (AC: 6)
  - [ ] Confirm LibraryView uses full available space
  - [ ] No visual regressions after cleanup

- [ ] **Task 5: Testing** (AC: all)
  - [ ] Verify app loads correctly without console errors
  - [ ] Verify kernel initialization still works
  - [ ] Verify database health check still passes
  - [ ] Check browser console shows debug messages on init

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
