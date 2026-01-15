
export interface ScannedFile {
    file: File;
    path: string;
}

export const getDirectoryHandle = async (): Promise<FileSystemDirectoryHandle> => {
    return await window.showDirectoryPicker();
};

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.wav', '.aiff', '.flac', '.m4a']);

export const scanDirectory = async (
    dirHandle: FileSystemDirectoryHandle,
    currentPath = '',
    results: ScannedFile[] = []
): Promise<ScannedFile[]> => {
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
            const fileEntry = entry as FileSystemFileHandle;
            const name = fileEntry.name.toLowerCase();
            const ext = name.substring(name.lastIndexOf('.'));

            if (SUPPORTED_EXTENSIONS.has(ext)) {
                const file = await fileEntry.getFile();
                const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                results.push({ file, path: relativePath });
            }
        } else if (entry.kind === 'directory') {
            const subDir = entry as FileSystemDirectoryHandle;
            const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            await scanDirectory(subDir, nextPath, results);
        }
    }
    return results;
};
