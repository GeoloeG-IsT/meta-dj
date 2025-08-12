import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

type Track = { id: string; title: string; file_path: string };

function listFoldersFromTracks(tracks: Track[]) {
    const set = new Set<string>();
    for (const t of tracks) set.add(path.dirname(t.file_path));
    return Array.from(set).sort();
}

function getDbPath(): string {
    const envPath = process.env.DJ_DB_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;
    const local = path.resolve(process.cwd(), '../../meta_dj.local.sqlite');
    return fs.existsSync(local) ? local : '';
}

export default function Home() {
    const dbPath = getDbPath();
    let tracks: Track[] = [];
    if (dbPath) {
        const db = new Database(dbPath, { readonly: true });
        tracks = db.prepare('SELECT id, title, file_path FROM tracks ORDER BY title LIMIT 200').all();
        db.close();
    }
    const folders = listFoldersFromTracks(tracks);
    return (
        <main style={{ display: 'flex', gap: 24, padding: 24 }}>
            <section style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 16 }}>
                <h2>Folders</h2>
                <ul style={{ maxHeight: 480, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                    {folders.map((f) => (
                        <li key={f}>{f}</li>
                    ))}
                </ul>
            </section>
            <section style={{ flex: 2 }}>
                <h2>Tracks</h2>
                <ul>
                    {tracks.map((t) => (
                        <li key={t.id}>{t.title}</li>
                    ))}
                </ul>
            </section>
        </main>
    );
}


