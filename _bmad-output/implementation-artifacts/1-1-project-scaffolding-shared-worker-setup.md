# Story 1.1: Project Scaffolding & Shared Worker Setup

Status: done

## Story

As a developer,
I want to initialize the project with Vite and establish the SharedWorker-based messaging kernel,
So that I have a high-performance foundation for the "Split-Brain" architecture that prevents UI lag from affecting core logic.

## Acceptance Criteria

1. [x] Initialize the project using the Vite React-TS template (Done: Project exists)
2. [x] Directory structure must match the "Feature-First" pattern defined in `architecture.md` (e.g., `src/modules`, `src/shared/kernel`)
3. [x] A `SharedWorker` must be successfully instantiated and connected to the main thread
4. [x] A typed message bus must be established supporting `WorkerMessage<T>` shapes with UUID correlation
5. [x] The Vite development server must be configured with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to enable `SharedArrayBuffer`
6. [x] The project must pass a basic "Heartbeat" test where the UI sends a `PING` and receives a `PONG` from the Worker.

## Tasks / Subtasks

- [x] Create project directory structure (AC: 2)
- [x] Define messaging types in `src/shared/types/messaging.ts` (AC: 4)
- [x] Implement `SharedWorker` kernel in `src/shared/kernel/kernel.worker.ts` (AC: 3, 4)
- [x] Implement `KernelManager` in `src/shared/kernel/kernel-manager.ts` (AC: 3, 4)
- [x] Configure Vite headers in `vite.config.ts` (AC: 5)
- [x] Implement Heartbeat test in `App.tsx` (AC: 6)
- [x] Verify with `npm run build` (AC: 1-6)

## Dev Notes

- Used `SharedWorker` for the kernel to allow multi-tab synchronization in the future if needed, and to keep logic separate from UI.
- `SharedArrayBuffer` support is enabled via COOP/COEP headers.
- Message bus uses UUID correlation for Promise-based request/response over `postMessage`.

### Project Structure Notes

- Feature-First structure implemented: `src/modules/{library,audio,database,hardware}`.
- Shared kernel and types in `src/shared`.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Strategy: Split-Brain Actor Model]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash

### Debug Log References

- Build successful with COOP/COEP and typed messaging.
- Heartbeat test implemented using `EventType.PING/PONG`.

### Completion Notes List

- Scaffolding complete.
- Kernel manager ready for database and audio integration.

### File List
- `src/shared/types/messaging.ts`
- `src/shared/kernel/kernel.worker.ts`
- `src/shared/kernel/kernel-manager.ts`
- `src/App.tsx`
- `vite.config.ts`
- `tsconfig.app.json`
