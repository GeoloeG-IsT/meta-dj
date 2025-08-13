'use client';

import React from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

function useSupabaseClient(): SupabaseClient | null {
    return React.useMemo(() => {
        if (!supabaseUrl || !supabaseAnonKey) return null;
        return createClient(supabaseUrl, supabaseAnonKey);
    }, []);
}

async function getAccessToken(supabase: SupabaseClient | null): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}

type WaveformViewerProps = {
    trackId: string;
    // Optional: override the storage path for the waveform artifact
    makePath?: (trackId: string) => string;
    height?: number;
    refreshNonce?: number;
};

export default function WaveformViewer({ trackId, makePath, height = 96, refreshNonce = 0 }: WaveformViewerProps) {
    const supabase = useSupabaseClient();
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string>('');
    const [url, setUrl] = React.useState<string>('');
    const [cacheBust, setCacheBust] = React.useState<number>(0);

    const authEnabled = Boolean(supabaseUrl && supabaseAnonKey);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError('');
            setUrl('');
            try {
                const token = await getAccessToken(supabase);
                if (!authEnabled || !token) {
                    // If auth isn't configured, we cannot sign URLs; show a helpful message
                    setError('Sign in (Supabase) required to view waveform artifact.');
                    return;
                }
                const path = makePath ? makePath(trackId) : `waveforms/${trackId}.png`;
                const res = await fetch(`${apiBase}/v1/storage/sign`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ path, expiresIn: 3600 }),
                });
                if (!res.ok) {
                    setError('Failed to sign waveform URL');
                    return;
                }
                const body = (await res.json()) as { url?: string };
                if (!body.url) {
                    setError('No waveform URL returned');
                    return;
                }
                if (mounted) {
                    // Add a cache-busting query string to ensure we fetch the freshly-uploaded image
                    setUrl(body.url + (body.url.includes('?') ? '&' : '?') + 't=' + Date.now());
                    setCacheBust((n) => n + 1);
                }
            } catch (e) {
                setError('Error fetching waveform');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [trackId, authEnabled, supabase, makePath, refreshNonce]);

    return (
        <section>
            {loading ? (
                <p>Loading waveform…</p>
            ) : error ? (
                <p style={{ color: 'crimson', fontSize: 12 }}>{error}</p>
            ) : url ? (
                <img
                    key={cacheBust}
                    src={url}
                    alt="Waveform"
                    style={{ display: 'block', height, width: '100%', objectFit: 'cover', background: '#111' }}
                />
            ) : (
                <p style={{ color: '#666' }}>No waveform available</p>
            )}
        </section>
    );
}


