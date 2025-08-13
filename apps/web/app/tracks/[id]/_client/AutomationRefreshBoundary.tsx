'use client';

import React from 'react';
import WaveformViewer from '../../../../components/WaveformViewer';
import AutomationActions from '../../../../components/AutomationActions';

export default function AutomationRefreshBoundary({ trackId }: { trackId: string }) {
    const [nonce, setNonce] = React.useState(0);
    return (
        <>
            <h3>Waveform</h3>
            <WaveformViewer trackId={trackId} refreshNonce={nonce} />
            <div style={{ marginTop: 16 }}>
                <AutomationActions trackId={trackId} onSuccess={() => setNonce((n) => n + 1)} />
            </div>
        </>
    );
}


