import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanDirectory, getDirectoryHandle } from './file-system';

describe('File System Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should open directory picker', async () => {
        const mockHandle = { kind: 'directory', name: 'music' };
        // @ts-expect-error - missing types for file system access api in test env
        global.showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle);

        const handle = await getDirectoryHandle();
        expect(global.showDirectoryPicker).toHaveBeenCalled();
        expect(handle).toBe(mockHandle);
    });

    it('should scan directory recursively and filter audio files', async () => {
        // Mock File System Handles
        const mockFileMp3 = {
            kind: 'file',
            name: 'song.mp3',
            getFile: vi.fn().mockResolvedValue(new File([''], 'song.mp3')),
        };
        const mockFileTxt = {
            kind: 'file',
            name: 'notes.txt',
            getFile: vi.fn().mockResolvedValue(new File([''], 'notes.txt')),
        };
        const mockSubDir = {
            kind: 'directory',
            name: 'subdir',
            values: vi.fn().mockReturnValue([mockFileMp3]),
        };

        // Mock iterator for root directory
        const mockRoot = {
            kind: 'directory',
            name: 'root',
            values: vi.fn().mockReturnValue([mockFileTxt, mockSubDir]),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = await scanDirectory(mockRoot as any);

        expect(files).toHaveLength(1);
        expect(files[0].file.name).toBe('song.mp3');
        // subDir 'subdir' -> 'subdir/song.mp3'
        expect(files[0].path).toBe('subdir/song.mp3');
    });

    it('should support multiple audio formats', async () => {
        const formats = ['test.mp3', 'test.wav', 'test.aiff', 'test.flac', 'test.m4a'];
        const mockFiles = formats.map(name => ({
            kind: 'file',
            name,
            getFile: vi.fn().mockResolvedValue(new File([''], name)),
        }));

        const mockRoot = {
            kind: 'directory',
            name: 'root',
            values: vi.fn().mockReturnValue(mockFiles),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = await scanDirectory(mockRoot as any);
        expect(files).toHaveLength(5);
        expect(files[0].path).toBe('test.mp3');
    });
});
