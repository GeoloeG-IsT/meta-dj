import { describe, it, expect, vi } from 'vitest';
import { parseTrackMetadata } from './metadata';
import * as mm from 'music-metadata-browser';

// Mock the external library
vi.mock('music-metadata-browser', () => ({
    parseBlob: vi.fn(),
}));

describe('Metadata Service', () => {
    it('should extract metadata from an audio file', async () => {
        const file = new File([''], 'test.mp3', { type: 'audio/mpeg' });

        // Mock successful parse response
        const mockMetadata = {
            common: {
                title: 'Test Song',
                artist: 'Test Artist',
                album: 'Test Album',
                bpm: 128,
                key: '9A',
                picture: [{ data: new Uint8Array([1, 2, 3]), format: 'image/jpeg' }]
            },
            format: {
                duration: 180
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mm.parseBlob as any).mockResolvedValue(mockMetadata);

        // Mock URL.createObjectURL for test env
        global.URL.createObjectURL = vi.fn(() => 'blob:test');

        const result = await parseTrackMetadata(file);

        expect(result).toEqual({
            title: 'Test Song',
            artist: 'Test Artist',
            album: 'Test Album',
            bpm: 128,
            key: '9A',
            duration: 180,
            artwork: 'blob:test',
            dateAdded: expect.any(Number),
        });
    });

    it('should handle missing metadata gracefully', async () => {
        const file = new File([''], 'unknown.wav', { type: 'audio/wav' });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mm.parseBlob as any).mockResolvedValue({
            common: {},
            format: { duration: 0 }
        });

        const result = await parseTrackMetadata(file);

        expect(result.title).toBe('unknown'); // Fallback to filename without extension
        expect(result.artist).toBeUndefined();
    });
});
