'use client';

import React from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Cue = {
    id: string;
    track_id: string;
    position_ms: number;
    color?: string | null;
    label?: string | null;
    type: string; // e.g., 'HOT'
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

function useSupabaseClient(): SupabaseClient | null {
    const client = React.useMemo(() => {
        if (!supabaseUrl || !supabaseAnonKey) return null;
        return createClient(supabaseUrl, supabaseAnonKey);
    }, []);
    return client;
}

async function fetchCues(trackId: string): Promise<Cue[]> {
    try {
        const res = await fetch(`${apiBase}/v1/cues/track/${encodeURIComponent(trackId)}`, { cache: 'no-store' });
        if (!res.ok) return [];
        const rows = (await res.json()) as Cue[];
        return rows;
    } catch {
        return [];
    }
}

async function getAccessToken(supabase: SupabaseClient | null): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}

async function upsertCue(cue: Cue, token: string): Promise<boolean> {
    const res = await fetch(`${apiBase}/v1/cues/${encodeURIComponent(cue.id)}`, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(cue),
    });
    return res.ok;
}

async function deleteCue(id: string, token: string): Promise<boolean> {
    const res = await fetch(`${apiBase}/v1/cues/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
            'authorization': `Bearer ${token}`,
        },
    });
    return res.ok;
}

export default function CuesEditor({ trackId }: { trackId: string }) {
    const supabase = useSupabaseClient();
    const [loading, setLoading] = React.useState(true);
    const [cues, setCues] = React.useState<Cue[]>([]);
    const [error, setError] = React.useState<string>('');
    const [positionMs, setPositionMs] = React.useState<string>('');
    const [label, setLabel] = React.useState<string>('');
    const [color, setColor] = React.useState<string>('');
    const [type, setType] = React.useState<string>('HOT');

    const authEnabled = Boolean(supabaseUrl && supabaseAnonKey);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            const rows = await fetchCues(trackId);
            if (mounted) {
                setCues(rows);
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [trackId]);

    async function handleAdd() {
        setError('');
        const pos = Number(positionMs);
        if (!Number.isFinite(pos)) { setError('Enter a valid position in ms'); return; }
        const token = await getAccessToken(supabase);
        if (!token) { setError('Sign in to add cues'); return; }
        const cue: Cue = {
            id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
            track_id: trackId,
            position_ms: Math.trunc(pos),
            label: label.trim() || null,
            color: color.trim() || null,
            type: (type || 'HOT'),
        };
        const ok = await upsertCue(cue, token);
        if (!ok) { setError('Failed to add cue'); return; }
        setCues((prev) => [...prev, cue].sort((a, b) => a.position_ms - b.position_ms));
        setPositionMs(''); setLabel(''); setColor(''); setType('HOT');
    }

    async function handleDelete(id: string) {
        setError('');
        const token = await getAccessToken(supabase);
        if (!token) { setError('Sign in to delete cues'); return; }
        const ok = await deleteCue(id, token);
        if (!ok) { setError('Failed to delete cue'); return; }
        setCues((prev) => prev.filter((c) => c.id !== id));
    }

    return (
        <section>
            <h3>Cues</h3>
            {!authEnabled && <p style={{ fontSize: 12, color: '#666' }}>Sign in (Supabase) to add or delete cues. Listing is available without auth.</p>}
            {error && <p style={{ color: 'crimson', fontSize: 12 }}>{error}</p>}
            {loading ? (
                <p>Loading…</p>
            ) : (
                <ul>
                    {cues.map((c) => (
                        <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ minWidth: 90 }}>{c.position_ms} ms</span>
                            <span style={{ minWidth: 60 }}>{c.type}</span>
                            <span style={{ minWidth: 80 }}>{c.color || '-'}</span>
                            <span style={{ flex: 1 }}>{c.label || '-'}</span>
                            <button type="button" disabled={!authEnabled} onClick={() => handleDelete(c.id)}>Delete</button>
                        </li>
                    ))}
                    {cues.length === 0 && <li style={{ color: '#666' }}>No cues</li>}
                </ul>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                    type="number"
                    placeholder="position ms"
                    value={positionMs}
                    onChange={(e) => setPositionMs(e.target.value)}
                    style={{ width: 120 }}
                />
                <input placeholder="label" value={label} onChange={(e) => setLabel(e.target.value)} />
                <input placeholder="color" value={color} onChange={(e) => setColor(e.target.value)} />
                <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="HOT">HOT</option>
                    <option value="MEMO">MEMO</option>
                    <option value="LOAD">LOAD</option>
                </select>
                <button type="button" disabled={!authEnabled} onClick={handleAdd}>Add cue</button>
            </div>
        </section>
    );
}


