/**
 * Recursive File System Access API Utility
 */

export interface ScannedFile {
  handle: FileSystemFileHandle;
  relativePath: string;
}

export const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.aac', '.flac', '.aiff', '.m4a'];

/**
 * Recursively scans a directory handle for supported audio files.
 */
export async function* scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path = ''
): AsyncGenerator<ScannedFile> {
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === 'file') {
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        yield {
          handle: entry as FileSystemFileHandle,
          relativePath: entryPath,
        };
      }
    } else if (entry.kind === 'directory') {
      yield* scanDirectory(entry as FileSystemDirectoryHandle, entryPath);
    }
  }
}
