'use client';
import React from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function AuthControls() {
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [msg, setMsg] = React.useState('');

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email ?? null));
    }, []);

    async function doSignUp() {
        setMsg('');
        const { error } = await supabase.auth.signUp({ email, password });
        setMsg(error ? error.message : 'Signed up. Check your email to confirm.');
    }

    async function doSignIn() {
        setMsg('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg(error.message);
        else {
            const { data } = await supabase.auth.getUser();
            setUserEmail(data?.user?.email ?? null);
            setMsg('Signed in');
        }
    }

    async function doSignOut() {
        await supabase.auth.signOut();
        setUserEmail(null);
        setMsg('Signed out');
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


