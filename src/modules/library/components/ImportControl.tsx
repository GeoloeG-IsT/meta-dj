import { useState } from 'react';
import { getDirectoryHandle, scanDirectory } from '../service/file-system';
import { parseTrackMetadata } from '../service/metadata';
import { useDbWorker } from '@/shared/kernel/message-bus';
import { DbAction } from '@/shared/types/db-types';

export const ImportControl = () => {
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const { sendMessage } = useDbWorker();

    const handleImport = async () => {
        try {
            setImporting(true);
            const dirHandle = await getDirectoryHandle();

            // 1. Scan (UI Thread)
            const files = await scanDirectory(dirHandle);
            setProgress({ current: 0, total: files.length });

            // 2. Parse & Ingest (Batched or streaming)
            let current = 0;
            const BATCH_SIZE = 5;

            // Simple batching to keep UI responsive
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (scannedFile) => {
                    const metadata = await parseTrackMetadata(scannedFile.file);
                    const track = {
                        ...metadata,
                        path: scannedFile.path, // Use the preserved relative path
                        filename: scannedFile.file.name,
                    };

                    await sendMessage(DbAction.INGEST_TRACK, track);
                }));

                current += batch.length;
                setProgress({ current: Math.min(current, files.length), total: files.length });

                // Allow UI to breathe
                await new Promise(resolve => setTimeout(resolve, 0));
            }

        } catch (err) {
            console.error('Import failed:', err);
        } finally {
            setImporting(false);
            setProgress(null);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
                {importing ? `Importing...` : 'Import Folder'}
            </button>
            {progress && (
                <div className="text-sm text-gray-300">
                    {progress.current} / {progress.total} tracks
                </div>
            )}
        </div>
    );
};
