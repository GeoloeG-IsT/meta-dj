import * as mm from 'music-metadata-browser';
import type { Track } from '@/shared/types/db-types';

export const parseTrackMetadata = async (file: File): Promise<Partial<Track>> => {
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
            const blob = new Blob([picture.data], { type: picture.format });
            track.artwork = URL.createObjectURL(blob);
        }

        return track;
    } catch {
        // Fallback for failed parsing
        return {
            title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
            dateAdded: Date.now(),
        };
    }
};
