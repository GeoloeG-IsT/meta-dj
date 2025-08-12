'use client';
import React from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function AuthControls() {
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [msg, setMsg] = React.useState('');
    const supabase: SupabaseClient | null = React.useMemo(() => {
        if (!supabaseUrl || !supabaseAnonKey) return null;
        return createClient(supabaseUrl, supabaseAnonKey);
    }, []);

    React.useEffect(() => {
        if (!supabase) return;
        supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email ?? null));
    }, [supabase]);

    async function doSignUp() {
        setMsg('');
        if (!supabase) { setMsg('Supabase not configured'); return; }
        const { error } = await supabase.auth.signUp({ email, password });
        setMsg(error ? error.message : 'Signed up. Check your email to confirm.');
    }

    async function doSignIn() {
        setMsg('');
        if (!supabase) { setMsg('Supabase not configured'); return; }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg(error.message);
        else {
            const { data } = await supabase.auth.getUser();
            setUserEmail(data?.user?.email ?? null);
            setMsg('Signed in');
        }
    }

    async function doSignOut() {
        if (supabase) await supabase.auth.signOut();
        setUserEmail(null);
        setMsg('Signed out');
    }

    if (!supabase) {
        return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12 }}>Auth disabled: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {userEmail ? (
                <>
                    <span style={{ fontSize: 12 }}>Signed in: {userEmail}</span>
                    <button type="button" onClick={doSignOut}>Sign out</button>
                </>
            ) : (
                <>
                    <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" onClick={doSignIn}>Sign in</button>
                    <button type="button" onClick={doSignUp}>Sign up</button>
                </>
            )}
            {msg && <span style={{ fontSize: 12, color: '#666' }}>{msg}</span>}
        </div>
    );
}


