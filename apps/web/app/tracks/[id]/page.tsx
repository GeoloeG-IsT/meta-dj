import Link from 'next/link';
import CuesEditor from '../../../components/CuesEditor';
import { revalidatePath } from 'next/cache';

type TrackDetail = { id: string; title: string; file_path: string; year?: number | null; genre?: string | null; duration_ms?: number | null; bpm_override?: number | null };

async function fetchTrack(id: string): Promise<TrackDetail | null> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const res = await fetch(base.replace(/\/$/, '') + `/v1/tracks/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
}

export default async function TrackPage({ params }: { params?: Promise<{ id: string }> }) {
    const p = params ? await params : undefined;
    const id = p?.id || '';
    const t = await fetchTrack(id);
    if (!t) return <main style={{ padding: 24 }}><h2>Not found</h2></main>;
    const trackId = t.id;
    async function updateBpm(formData: FormData) {
        'use server';
        const bpmStr = String(formData.get('bpm') || '').trim();
        const bpm = bpmStr ? Number(bpmStr) : NaN;
        if (!Number.isFinite(bpm)) return;
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
        await fetch(base.replace(/\/$/, '') + `/v1/tracks/${encodeURIComponent(trackId)}/bpm-override`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bpm })
        });
        revalidatePath(`/tracks/${trackId}`);
    }
    return (
        <main style={{ padding: 24 }}>
            <Link href="/">← Back</Link>
            <h1>{t.title}</h1>
            <p><b>File</b>: {t.file_path}</p>
            <p><b>Year</b>: {t.year ?? '-'}</p>
            <p><b>Genre</b>: {t.genre ?? '-'}</p>
            <p><b>Duration</b>: {t.duration_ms ? Math.round(t.duration_ms / 1000) + ' s' : '-'}</p>
            <p><b>BPM override</b>: {t.bpm_override ?? '-'}</p>
            <hr />
            <h3>Waveform</h3>
            <p>(placeholder) Render waveform once artifact API is available.</p>
            <h3>Editing</h3>
            <form action={updateBpm} style={{ marginBottom: 16 }}>
                <label>BPM:&nbsp;<input name="bpm" type="number" min={40} max={220} step={0.01} defaultValue={t.bpm_override ?? ''} /></label>
                &nbsp;<button type="submit">Save</button>
            </form>
            {/* Client component */}
            <CuesEditor trackId={trackId} />
            <ul style={{ marginTop: 16 }}>
                <li>Automation: Re-analyze / Auto-cues (TBD)</li>
            </ul>
        </main>
    );
}

// no-op


