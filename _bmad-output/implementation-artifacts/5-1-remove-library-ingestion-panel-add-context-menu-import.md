# Story 5.1: Remove Library Ingestion Panel & Add Context Menu Import

Status: done

## Story

As a user,
I want to import folders via a context menu on "All Tracks" instead of a dedicated panel,
So that the UI is cleaner and the import action is discoverable where I'm already browsing.

## Acceptance Criteria

1. **Remove ImportControl Panel:** Given the current LibraryView with the ImportControl panel above the track list, when this story is complete, then the `<ImportControl />` component must be removed from `LibraryView.tsx` and the div wrapper containing it must be deleted.

2. **Context Menu Integration:** The PlaylistTree must have the "Import Folder..." option in the right-click context menu on the "All Tracks" node, positioned before the "Clear Library" option.

3. **Same Import Logic:** The context menu "Import Folder..." option must trigger the same folder selection logic currently in ImportControl (`window.showDirectoryPicker()` + `ingestService.ingestDirectory()`).

4. **Toast Progress Feedback:** Import progress must appear as a toast notification rather than inline, showing current file and progress count (e.g., "Importing: track.mp3 (42/128)").

5. **Error Handling:** Import errors must display as error toasts with the error message.

6. **Completion Feedback:** On successful completion, show a success toast (e.g., "Imported 128 tracks").

## Tasks / Subtasks

- [x] **Task 1: Remove ImportControl from LibraryView** (AC: 1)
  - [x] Delete the `<ImportControl />` component and its wrapper div from `LibraryView.tsx`
  - [x] Remove the `ImportControl` import statement
  - [x] Verify no layout issues after removal (track list should expand up)

- [x] **Task 2: Add Import Folder to Context Menu** (AC: 2, 3)
  - [x] Add "Import Folder..." option to `allTracksMenuOptions` in `PlaylistTree.tsx`
  - [x] Add FolderInput or appropriate Lucide icon for the menu item
  - [x] Create `handleImportFolder` function that replicates ImportControl logic
  - [x] Position "Import Folder..." before "Clear Library" in menu

- [x] **Task 3: Implement Toast-Based Progress** (AC: 4, 5, 6)
  - [x] Create a persistent/updating toast for import progress
  - [x] Update toast content during ingestion with current file and count
  - [x] Show error toast on failure with error message
  - [x] Show success toast on completion with total count
  - [x] Auto-dismiss success toast after ~3 seconds

- [x] **Task 4: Cleanup** (AC: all)
  - [x] Consider deleting `ImportControl.tsx` if no longer used elsewhere
  - [x] Verify import functionality works end-to-end
  - [x] Test error scenarios (user cancels picker, invalid folder)

## Dev Notes

### Critical Files

**Files to Modify:**
```
src/modules/library/LibraryView.tsx          # Remove ImportControl
src/modules/library/components/PlaylistTree.tsx  # Add context menu option
```

**Files Potentially to Delete:**
```
src/modules/library/components/ImportControl.tsx  # May be unused after refactor
```

### Current Implementation Reference

**ImportControl.tsx - Core Logic to Preserve:**
```typescript
const handleImport = async () => {
  try {
    // @ts-ignore - File System Access API
    const dirHandle = await window.showDirectoryPicker();

    setIsIngesting(true);
    setError(null);

    await ingestService.ingestDirectory(dirHandle, (p) => {
      setProgress(p);  // This becomes toast update
    });

    // Success handling
  } catch (err: any) {
    if (err.name === 'AbortError') return;  // User cancelled
    // Error handling
  }
};
```

**PlaylistTree.tsx - Context Menu Pattern:**
```typescript
const allTracksMenuOptions = [
  {
    label: 'Import Folder...',  // ADD THIS
    icon: <FolderInput size={14} />,
    onClick: handleImportFolder
  },
  {
    label: 'Clear Library',
    icon: <Trash2 size={14} />,
    danger: true,
    onClick: handleClearLibrary
  }
];
```

### Toast Integration

Use existing toast system from `src/shared/components/Toast.tsx`:

```typescript
import { toast } from '../../shared/components/Toast';

// Progress toast (persistent until dismissed)
const toastId = toast.show('Importing: scanning...', 'info', 0); // 0 = no auto-dismiss

// Update toast during progress
toast.update(toastId, `Importing: ${progress.currentFile} (${progress.processed}/${progress.total})`);

// Success
toast.dismiss(toastId);
toast.show(`Imported ${progress.total} tracks`, 'success');

// Error
toast.dismiss(toastId);
toast.show(`Import failed: ${err.message}`, 'error');
```

### Visual Hierarchy After Change

**Before:**
```
┌─────────────────────────────────────┐
│ [ImportControl Panel]               │  <- REMOVE
├─────────────────────────────────────┤
│ [Track List]                        │
│                                     │
└─────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│ [Track List - now starts higher]    │
│                                     │
│                                     │
└─────────────────────────────────────┘

Right-click "All Tracks":
┌──────────────────┐
│ Import Folder... │
│ ──────────────── │
│ Clear Library    │
└──────────────────┘
```

### Edge Cases

1. **User cancels folder picker:** `AbortError` - silently ignore, no toast needed
2. **Empty folder selected:** Show toast "No audio files found in folder"
3. **Import already in progress:** Disable menu item or show warning toast
4. **Permission denied:** Show error toast with guidance

### Dependencies

- `ingestService` from `../services/ingest-service`
- `toast` from `../../shared/components/Toast`
- `FolderInput` or similar from `lucide-react`

### References

- [Source: src/modules/library/components/ImportControl.tsx]
- [Source: src/modules/library/components/PlaylistTree.tsx]
- [Source: src/modules/library/LibraryView.tsx]
- [Source: src/shared/components/Toast.tsx]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- **Task 1:** Removed `ImportControl` import and component from `LibraryView.tsx`. Deleted the wrapper div containing `<ImportControl />`. Track list now starts higher in the layout.

- **Task 2:** Added `handleImportFolder` async function to `PlaylistTree.tsx` replicating the import logic from `ImportControl`. Added "Import Folder..." menu option with `FolderInput` icon, positioned before "Clear Library". Added `disabled` prop to prevent concurrent imports.

- **Task 3:** Added `update` method to `toast.store.ts` for updating existing toast messages during progress. Implemented progress toast that updates during ingestion with current file and count. Success toast on completion, error toast on failure. AbortError (user cancel) is silently ignored.

- **Task 4:** Deleted `ImportControl.tsx` as it is no longer used. Verified 241 unit tests pass. Import functionality integrated into PlaylistTree context menu.

### File List

**Created:**
- src/shared/store/toast.store.test.ts (17 tests for toast functionality including persistent toast tests)

**Modified:**
- src/modules/library/LibraryView.tsx (removed ImportControl import and component)
- src/modules/library/components/PlaylistTree.tsx (added handleImportFolder, context menu option, empty folder handling)
- src/modules/library/components/ContextMenu.tsx (added ContextMenuOption export, ReactNode icon type, disabled prop support)
- src/shared/store/toast.store.ts (added update, progress, persistent flag, duration=0 support)

**Deleted:**
- src/modules/library/components/ImportControl.tsx

### Change Log

- 2026-01-16: Completed all tasks. Removed ImportControl panel from LibraryView, added Import Folder context menu option to PlaylistTree, implemented toast-based progress feedback with new update method, deleted unused ImportControl.tsx. 241 tests pass (13 new).
- 2026-01-16: Code Review fixes applied:
  - H1/H2: Added persistent toast support (no auto-dismiss, won't be evicted) via `toast.progress()`
  - M1: Fixed type safety - exported ContextMenuOption interface, removed `as any` cast
  - M2: Added empty folder handling with warning message
  - M3: Updated toast.store.ts header comment
  - Added 4 new tests for persistent toast functionality. 245 tests pass (17 toast tests total).
