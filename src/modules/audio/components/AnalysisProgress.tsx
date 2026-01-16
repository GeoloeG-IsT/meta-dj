/**
 * AnalysisProgress - Progress indicator for track analysis
 *
 * Shows a progress bar and status text for track analysis (BPM/Key/Beatgrid).
 */

import React from 'react';
import { useAnalysisStore, selectTrackAnalysis, type TrackAnalysisState } from '../store/analysis.store';

interface AnalysisProgressProps {
  trackId: number;
  compact?: boolean;
}

/**
 * Get stage display text
 */
function getStageText(stage: TrackAnalysisState['stage']): string {
  switch (stage) {
    case 'decoding':
      return 'Decoding audio...';
    case 'analyzing':
      return 'Detecting BPM & Key...';
    case 'storing':
      return 'Saving results...';
    default:
      return '';
  }
}

/**
 * Get status color
 */
function getStatusColor(status: TrackAnalysisState['status']): string {
  switch (status) {
    case 'analyzing':
      return '#4DFA90'; // Engine Green
    case 'complete':
      return '#2E8CFF'; // Denon Blue
    case 'error':
      return '#FF3B30'; // Error Red
    default:
      return '#666666';
  }
}

/**
 * Inline progress indicator for track rows
 */
export const AnalysisProgressInline: React.FC<AnalysisProgressProps> = ({ trackId, compact = true }) => {
  const analysisState = useAnalysisStore(selectTrackAnalysis(trackId));

  if (!analysisState || analysisState.status === 'idle') {
    return null;
  }

  if (analysisState.status === 'complete') {
    return null; // Don't show anything when complete, the BPM/Key columns will update
  }

  if (analysisState.status === 'error') {
    return (
      <span className="text-red-500 text-[10px] uppercase font-mono">
        Error
      </span>
    );
  }

  // Analyzing - show progress
  const progress = Math.round(analysisState.progress * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-8 h-1 bg-[#333] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4DFA90] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-[#4DFA90]/60 font-mono">
          {progress}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-[#4DFA90]/60 font-mono">
        <span>{getStageText(analysisState.stage)}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#4DFA90] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Full progress indicator with details
 */
export const AnalysisProgressFull: React.FC<AnalysisProgressProps> = ({ trackId }) => {
  const analysisState = useAnalysisStore(selectTrackAnalysis(trackId));

  if (!analysisState) {
    return null;
  }

  const color = getStatusColor(analysisState.status);
  const progress = Math.round(analysisState.progress * 100);

  return (
    <div className="p-4 bg-[#121212] border border-[#4DFA90]/20 rounded-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold" style={{ color }}>
          {analysisState.status === 'analyzing'
            ? 'Analyzing...'
            : analysisState.status === 'complete'
            ? 'Complete'
            : analysisState.status === 'error'
            ? 'Error'
            : 'Idle'}
        </span>
        <span className="text-sm font-mono" style={{ color }}>
          {progress}%
        </span>
      </div>

      <div className="w-full h-2 bg-[#333] rounded-full overflow-hidden mb-2">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
      </div>

      {analysisState.stage && (
        <div className="text-xs text-[#4DFA90]/60 font-mono">
          {getStageText(analysisState.stage)}
        </div>
      )}

      {analysisState.error && (
        <div className="text-xs text-red-500 mt-2">
          {analysisState.error}
        </div>
      )}

      {analysisState.status === 'complete' && analysisState.bpm && analysisState.key && (
        <div className="flex gap-4 mt-2 text-sm">
          <div>
            <span className="text-[#4DFA90]/60">BPM: </span>
            <span className="text-[#4DFA90] font-mono">{analysisState.bpm}</span>
          </div>
          <div>
            <span className="text-[#4DFA90]/60">Key: </span>
            <span className="text-[#4DFA90] font-mono">{analysisState.key}</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Queue status indicator
 */
export const AnalysisQueueStatus: React.FC = () => {
  const queue = useAnalysisStore((state) => state.queue);
  const isProcessing = useAnalysisStore((state) => state.isProcessing);

  if (!isProcessing && queue.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#121212] border border-[#4DFA90]/20 rounded-full text-xs">
      <div className="w-2 h-2 rounded-full bg-[#4DFA90] animate-pulse" />
      <span className="text-[#4DFA90]/80 font-mono uppercase">
        Analyzing {queue.length + (isProcessing ? 1 : 0)} tracks
      </span>
    </div>
  );
};
