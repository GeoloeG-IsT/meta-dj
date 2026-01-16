# Story 5.1: Remove Library Ingestion Panel & Add Context Menu Import

Status: ready-for-dev

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

- [ ] **Task 1: Remove ImportControl from LibraryView** (AC: 1)
  - [ ] Delete the `<ImportControl />` component and its wrapper div from `LibraryView.tsx`
  - [ ] Remove the `ImportControl` import statement
  - [ ] Verify no layout issues after removal (track list should expand up)

- [ ] **Task 2: Add Import Folder to Context Menu** (AC: 2, 3)
  - [ ] Add "Import Folder..." option to `allTracksMenuOptions` in `PlaylistTree.tsx`
  - [ ] Add FolderInput or appropriate Lucide icon for the menu item
  - [ ] Create `handleImportFolder` function that replicates ImportControl logic
  - [ ] Position "Import Folder..." before "Clear Library" in menu

- [ ] **Task 3: Implement Toast-Based Progress** (AC: 4, 5, 6)
  - [ ] Create a persistent/updating toast for import progress
  - [ ] Update toast content during ingestion with current file and count
  - [ ] Show error toast on failure with error message
  - [ ] Show success toast on completion with total count
  - [ ] Auto-dismiss success toast after ~3 seconds

- [ ] **Task 4: Cleanup** (AC: all)
  - [ ] Consider deleting `ImportControl.tsx` if no longer used elsewhere
  - [ ] Verify import functionality works end-to-end
  - [ ] Test error scenarios (user cancels picker, invalid folder)

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

(To be filled on completion)

### Debug Log References

(To be filled on completion)

### Completion Notes List

(To be filled on completion)

### File List

**Created:**
(To be filled on completion)

**Modified:**
(To be filled on completion)

**Deleted:**
(To be filled on completion)

### Change Log

(To be filled on completion)
