import Link from 'next/link';
import AuthControls from '../components/AuthControls';

type Track = { id: string; title: string; file_path: string };

async function fetchTracks(search: string, folder: string): Promise<Track[]> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://api:8080';
    const url = new URL(base.replace(/\/$/, '') + '/v1/tracks/');
    if (search) url.searchParams.set('q', search);
    if (folder) url.searchParams.set('folder', folder);
    try {
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

function listFoldersFromTracks(tracks: Track[]): string[] {
    const folders = new Set<string>();
    for (const t of tracks) {
        const parts = t.file_path.split('/');
        if (parts.length > 1) folders.add(parts.slice(0, parts.length - 1).join('/'));
    }
    return Array.from(folders).sort();
}

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const sp = searchParams ? await searchParams : undefined;
    const q = (sp?.q as string | undefined || '').trim();
    const folder = (sp?.folder as string | undefined || '').trim();
    const tracks = await fetchTracks(q, folder);
    const folders = listFoldersFromTracks(tracks);
    return (
        <main style={{ display: 'flex', gap: 24, padding: 24 }}>
            <section style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 16 }}>
                <h2>Folders</h2>
                <ul style={{ maxHeight: 480, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                    {folders.map((f) => (
                        <li key={f}><Link href={`/?folder=${encodeURIComponent(f)}`}>{f}</Link></li>
                    ))}
                </ul>
            </section>
            <section style={{ flex: 2 }}>
                <h2>Tracks {q ? `(q=${q})` : ''} {folder ? `(folder=${folder})` : ''}</h2>
                <div style={{ marginBottom: 12, fontSize: 12 }}>
                    <AuthControls />
                </div>
                <form action="/" method="get" style={{ marginBottom: 12 }}>
                    <input type="text" name="q" placeholder="Search title..." defaultValue={q} />{' '}
                    <button type="submit">Search</button>
                </form>
                <ul>
                    {tracks.map((t) => (
                        <li key={t.id}><Link href={`/tracks/${t.id}`}>{t.title}</Link></li>
                    ))}
                </ul>
            </section>
        </main>
    );
}


