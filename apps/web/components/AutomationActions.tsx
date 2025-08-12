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

export default function AutomationActions({ trackId }: { trackId: string }) {
    const supabase = useSupabaseClient();
    const [message, setMessage] = React.useState<string>('');
    const [loading, setLoading] = React.useState<boolean>(false);

    const authEnabled = Boolean(supabaseUrl && supabaseAnonKey);

    async function callEndpoint(path: string, body: any) {
        setMessage('');
        setLoading(true);
        try {
            const token = await getAccessToken(supabase);
            if (!token) {
                setMessage('Sign in (Supabase) to trigger automation');
                return;
            }
            const res = await fetch(`${apiBase}${path}`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            if (res.status === 404) {
                setMessage('Endpoint not available yet (API TODO)');
                return;
            }
            if (!res.ok) {
                setMessage(`Request failed (${res.status})`);
                return;
            }
            setMessage('Request accepted');
        } catch (e) {
            setMessage('Network error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <section>
            <h3>Automation</h3>
            {!authEnabled && (
                <p style={{ fontSize: 12, color: '#666' }}>Sign in (Supabase) to enable actions.</p>
            )}
            {message && <p style={{ fontSize: 12 }}>{message}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    type="button"
                    disabled={!authEnabled || loading}
                    onClick={() => callEndpoint('/v1/analysis/reanalyze', { trackId })}
                >
                    Re-analyze
                </button>
                <button
                    type="button"
                    disabled={!authEnabled || loading}
                    onClick={() => callEndpoint('/v1/automation/auto-cues', { trackId })}
                >
                    Auto-cues
                </button>
            </div>
        </section>
    );
}


