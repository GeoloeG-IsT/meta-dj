import Link from 'next/link';
import AuthControls from '../components/AuthControls';

type Track = { id: string; title: string; file_path: string };

type FolderNode = { name: string; path: string; children: FolderNode[] };

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

async function fetchFolderTree(): Promise<FolderNode> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://api:8080';
    const url = new URL(base.replace(/\/$/, '') + '/v1/tracks/');
    url.searchParams.set('fields', 'file_path');
    url.searchParams.set('limit', '10000');
    try {
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) return { name: '', path: '', children: [] };
        const rows = (await res.json()) as { file_path: string }[];
        const filePaths = rows.map((r) => r.file_path).filter(Boolean);
        return buildFolderTree(filePaths);
    } catch {
        return { name: '', path: '', children: [] };
    }
}

function buildFolderTree(filePaths: string[]): FolderNode {
    type TempNode = { name: string; path: string; children: Map<string, TempNode> };
    const root: TempNode = { name: '', path: '', children: new Map() };
    for (const fpRaw of filePaths) {
        const normalized = fpRaw.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length < 2) continue; // no parent folder present
        const dirs = parts.slice(0, parts.length - 1);
        let node = root;
        let accum = '';
        for (const dir of dirs) {
            accum = accum ? `${accum}/${dir}` : dir;
            if (!node.children.has(dir)) {
                node.children.set(dir, { name: dir, path: accum, children: new Map() });
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            node = node.children.get(dir)!;
        }
    }
    const toFolderNode = (n: TempNode): FolderNode => {
        const children = Array.from(n.children.values()).map(toFolderNode);
        children.sort((a, b) => a.name.localeCompare(b.name));
        return { name: n.name, path: n.path, children };
    };
    return { name: '', path: '', children: Array.from(root.children.values()).map(toFolderNode) };
}

function renderFolderTree(node: FolderNode, currentFolder: string, q: string) {
    const makeHref = (path: string) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (path) params.set('folder', path);
        const qs = params.toString();
        return qs ? `/?${qs}` : '/';
    };
    return (
        <ul style={{ listStyle: 'none', paddingLeft: 16 }}>
            {node.children.map((child) => (
                <li key={child.path}>
                    <Link href={makeHref(child.path)} style={{ fontWeight: child.path === currentFolder ? 600 : 400 }}>
                        {child.name}
                    </Link>
                    {child.children.length > 0 ? renderFolderTree(child, currentFolder, q) : null}
                </li>
            ))}
        </ul>
    );
}

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const sp = searchParams ? await searchParams : undefined;
    const q = (sp?.q as string | undefined || '').trim();
    const folder = (sp?.folder as string | undefined || '').trim();
    const [tracks, folderTree] = await Promise.all([
        fetchTracks(q, folder),
        fetchFolderTree(),
    ]);
    return (
        <main style={{ display: 'flex', gap: 24, padding: 24 }}>
            <section style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 16 }}>
                <h2>Folders</h2>
                <div style={{ marginBottom: 8, fontSize: 12 }}>
                    <Link href="/">All folders</Link>
                </div>
                <div style={{ maxHeight: 480, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                    {renderFolderTree(folderTree, folder, q)}
                </div>
            </section>
            <section style={{ flex: 2 }}>
                <h2>Tracks {q ? `(q=${q})` : ''} {folder ? `(folder=${folder})` : ''}</h2>
                <div style={{ marginBottom: 12, fontSize: 12 }}>
                    <AuthControls />
                </div>
                <form action="/" method="get" style={{ marginBottom: 12 }}>
                    <input type="text" name="q" placeholder="Search title..." defaultValue={q} />{' '}
                    {folder ? <input type="hidden" name="folder" value={folder} /> : null}
                    <button type="submit">Search</button>
                </form>
                {folder ? (
                    <div style={{ marginBottom: 8, fontSize: 12 }}>
                        Path: <Link href="/">root</Link>
                        {folder.split('/').filter(Boolean).map((seg, idx, arr) => {
                            const p = arr.slice(0, idx + 1).join('/');
                            const params = new URLSearchParams();
                            if (q) params.set('q', q);
                            params.set('folder', p);
                            return (
                                <span key={p}>
                                    {' / '}<Link href={`/?${params.toString()}`}>{seg}</Link>
                                </span>
                            );
                        })}
                    </div>
                ) : null}
                <ul>
                    {tracks.map((t) => (
                        <li key={t.id}><Link href={`/tracks/${t.id}`}>{t.title}</Link></li>
                    ))}
                </ul>
            </section>
        </main>
    );
}


