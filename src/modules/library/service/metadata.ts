import * as mm from 'music-metadata-browser';
import type { Track } from '@/shared/types/db-types';

export interface ParseResult {
    track: Partial<Track>;
    error?: string;
}

export const parseTrackMetadata = async (file: File): Promise<ParseResult> => {
    try {
        const metadata = await mm.parseBlob(file);

        const track: Partial<Track> = {
            title: metadata.common.title || file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
            artist: metadata.common.artist,
            album: metadata.common.album,
            bpm: metadata.common.bpm,
            key: metadata.common.key,
            duration: metadata.format.duration,
            dateAdded: Date.now(),
        };

        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const blob = new Blob([picture.data as any], { type: picture.format });
            track.artwork = URL.createObjectURL(blob);
        }

        return { track };
    } catch (err) {
        // Return fallback with error message
        return {
            track: {
                title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
                dateAdded: Date.now(),
            },
            error: err instanceof Error ? err.message : String(err),
        };
    }
};
