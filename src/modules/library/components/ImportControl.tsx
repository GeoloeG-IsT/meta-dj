import { useState, useCallback } from 'react';
import { getDirectoryHandle, scanDirectory } from '../service/file-system';
import { parseTrackMetadata } from '../service/metadata';
import { useDbWorker } from '@/shared/kernel/message-bus';
import { DbAction } from '@/shared/types/db-types';

export const ImportControl = () => {
    const [importing, setImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; errors: number } | null>(null);
    const { sendMessage } = useDbWorker();

    const processImport = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
        let errors = 0;
        try {
            setImporting(true);
            
            // 1. Scan (UI Thread)
            const files = await scanDirectory(dirHandle);
            setProgress({ current: 0, total: files.length, errors: 0 });

            // 2. Parse & Ingest (Batched or streaming)
            let current = 0;
            const BATCH_SIZE = 5;

            // Simple batching to keep UI responsive
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (scannedFile) => {
                    const { track, error } = await parseTrackMetadata(scannedFile.file);
                    
                    if (error) {
                        console.warn(`Metadata parse error for ${scannedFile.file.name}:`, error);
                        errors++;
                    }

                    const dbTrack = {
                        ...track,
                        path: scannedFile.path, // Use the preserved relative path
                        filename: scannedFile.file.name,
                    };

                    await sendMessage(DbAction.INGEST_TRACK, dbTrack);
                }));

                current += batch.length;
                setProgress({ current: Math.min(current, files.length), total: files.length, errors });

                // Allow UI to breathe
                await new Promise(resolve => setTimeout(resolve, 0));
            }

        } catch (err) {
            console.error('Import failed:', err);
        } finally {
            setImporting(false);
            if (errors === 0) {
                 setProgress(null);
            }
        }
    }, [sendMessage]);

    const handleImportClick = async () => {
        try {
            const dirHandle = await getDirectoryHandle();
            await processImport(dirHandle);
        } catch (err) {
            // User cancelled or error
            console.log('Picker cancelled or failed', err);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const items = Array.from(e.dataTransfer.items);
        // Look for a directory
        // Note: 'getAsFileSystemHandle' is the modern standard way
        for (const item of items) {
            if (item.kind === 'file') {
                try {
                    const handle = await item.getAsFileSystemHandle();
                    if (handle && handle.kind === 'directory') {
                        await processImport(handle as FileSystemDirectoryHandle);
                        return; // Process first folder found
                    }
                } catch (err) {
                    console.error('Failed to get handle from drop:', err);
                }
            }
        }
    }, [processImport]);

    return (
        <div 
            className={`flex items-center gap-4 p-4 border-2 border-dashed rounded transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50/10' : 'border-transparent'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <button
                onClick={handleImportClick}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
                {importing ? `Importing...` : 'Import Folder'}
            </button>
            {progress && (
                <div className="text-sm text-gray-300">
                    {progress.current} / {progress.total} tracks
                    {progress.errors > 0 && <span className="text-red-400 ml-2">({progress.errors} errors)</span>}
                </div>
            )}
            {!importing && !progress && (
                <div className="text-xs text-gray-500 hidden sm:block">
                    or drag folder here
                </div>
            )}
        </div>
    );
};
