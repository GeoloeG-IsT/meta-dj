/**
 * WaveformCanvas - React wrapper for WebGL waveform renderer
 *
 * Provides a declarative React interface to the imperative WaveformRenderer.
 * Handles lifecycle, resize, and animation frame management.
 */

import { useRef, useEffect, useCallback } from 'react';
import { WaveformRenderer, type ViewRange } from './WaveformRenderer';
import type { WaveformData } from '../analysis/waveform-analyzer';
import type { WaveformColorMode } from '../types';

export interface WaveformCanvasProps {
  /** Waveform data to render */
  waveformData: WaveformData | null;
  /** Current playhead position (0-1) */
  playheadPosition?: number;
  /** Visible range of the waveform */
  viewRange?: ViewRange;
  /** Color mode for rendering */
  colorMode?: WaveformColorMode;
  /** CSS class name */
  className?: string;
  /** Click handler for needle drop seeking */
  onClick?: (normalizedPosition: number) => void;
  /** Whether to animate (run render loop) */
  animate?: boolean;
}

/**
 * High-performance WebGL waveform canvas component.
 *
 * Uses requestAnimationFrame for smooth 60fps rendering when animate=true.
 * Otherwise renders on prop changes only.
 */
export function WaveformCanvas({
  waveformData,
  playheadPosition = 0,
  viewRange = { start: 0, end: 1 },
  colorMode = 'rgb',
  className = '',
  onClick,
  animate = false,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WaveformRenderer | null>(null);
  const animationFrameRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);

  // Initialize renderer (colorMode is applied via separate useEffect to avoid stale closure)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const renderer = new WaveformRenderer({
        canvas,
        // Use default colorMode here; actual value is set by the colorMode useEffect
        colorMode: 'rgb',
        devicePixelRatio: window.devicePixelRatio,
      });
      rendererRef.current = renderer;

      // Initial render (will be updated when colorMode useEffect runs)
      renderer.render();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        renderer.dispose();
        rendererRef.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize WaveformRenderer:', error);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const resizeObserver = new ResizeObserver(() => {
      renderer.resize();
      if (!isAnimatingRef.current) {
        renderer.render();
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update waveform data
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setWaveformData(waveformData);
    if (!isAnimatingRef.current) {
      renderer.render();
    }
  }, [waveformData]);

  // Update playhead position
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setPlayheadPosition(playheadPosition);
    if (!isAnimatingRef.current) {
      renderer.render();
    }
  }, [playheadPosition]);

  // Update view range
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setViewRange(viewRange.start, viewRange.end);
    if (!isAnimatingRef.current) {
      renderer.render();
    }
  }, [viewRange.start, viewRange.end]);

  // Update color mode
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setColorMode(colorMode);
    if (!isAnimatingRef.current) {
      renderer.render();
    }
  }, [colorMode]);

  // Animation loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (animate) {
      isAnimatingRef.current = true;

      const renderLoop = () => {
        renderer.render();
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      };

      animationFrameRef.current = requestAnimationFrame(renderLoop);

      return () => {
        isAnimatingRef.current = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      isAnimatingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [animate]);

  // Handle click for needle drop
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onClick || !waveformData) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const clickRatio = x / rect.width;

      // Convert click position to track position considering view range
      const trackPosition =
        viewRange.start + clickRatio * (viewRange.end - viewRange.start);

      onClick(Math.max(0, Math.min(1, trackPosition)));
    },
    [onClick, viewRange.start, viewRange.end, waveformData]
  );

  return (
    <canvas
      ref={canvasRef}
      className={`waveform-canvas ${className}`}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: '#000000', // OLED Black fallback
      }}
    />
  );
}
