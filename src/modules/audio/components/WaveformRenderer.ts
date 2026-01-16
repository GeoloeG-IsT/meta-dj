/**
 * WaveformRenderer - High-performance WebGL2 waveform visualization
 *
 * Uses instanced rendering for efficient drawing of thousands of bars.
 * Designed for 60fps rendering with minimal GC pressure.
 */

import type { WaveformData } from '../analysis/waveform-analyzer';
import type { WaveformColorMode } from '../types';

// Import shaders as raw strings
import vertexShaderSource from '../shaders/waveform.vert.glsl?raw';
import fragmentShaderSource from '../shaders/waveform.frag.glsl?raw';
import playheadVertSource from '../shaders/playhead.vert.glsl?raw';
import playheadFragSource from '../shaders/playhead.frag.glsl?raw';

export interface WaveformRendererOptions {
  /** Target canvas element */
  canvas: HTMLCanvasElement;
  /** Initial color mode */
  colorMode?: WaveformColorMode;
  /** Device pixel ratio for high-DPI displays */
  devicePixelRatio?: number;
}

export interface ViewRange {
  /** Start position (0-1) */
  start: number;
  /** End position (0-1) */
  end: number;
}

const COLOR_MODE_MAP: Record<WaveformColorMode, number> = {
  rgb: 0,
  blue: 1,
  '3band': 2,
};

/**
 * WebGL2-based waveform renderer with instanced drawing.
 */
export class WaveformRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private playheadProgram: WebGLProgram | null = null;
  private devicePixelRatio: number;

  // Waveform buffers
  private positionBuffer: WebGLBuffer | null = null;
  private lowPeakBuffer: WebGLBuffer | null = null;
  private midPeakBuffer: WebGLBuffer | null = null;
  private highPeakBuffer: WebGLBuffer | null = null;
  private cornerBuffer: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  // Playhead buffers
  private playheadBuffer: WebGLBuffer | null = null;
  private playheadVao: WebGLVertexArrayObject | null = null;

  // Uniform locations
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private playheadUniforms: Record<string, WebGLUniformLocation | null> = {};

  // State
  private colorMode: WaveformColorMode = 'rgb';
  private viewRange: ViewRange = { start: 0, end: 1 };
  private playheadPosition = 0;
  private barCount = 0;
  private isInitialized = false;
  private contextLost = false;

  // Pre-allocated typed arrays for buffer updates
  private positionArray: Float32Array | null = null;
  private lowArray: Float32Array | null = null;
  private midArray: Float32Array | null = null;
  private highArray: Float32Array | null = null;

  // Bound event handlers for context loss (stored for cleanup)
  private handleContextLost: (e: Event) => void;
  private handleContextRestored: () => void;

  constructor(options: WaveformRendererOptions) {
    this.canvas = options.canvas;
    this.devicePixelRatio = options.devicePixelRatio ?? window.devicePixelRatio ?? 1;
    this.colorMode = options.colorMode ?? 'rgb';

    // Setup context loss handlers
    this.handleContextLost = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      this.isInitialized = false;
      console.warn('WebGL context lost');
    };

    this.handleContextRestored = () => {
      console.info('WebGL context restored, reinitializing...');
      this.contextLost = false;
      this.init();
      // Re-upload waveform data if we had it
      if (this.positionArray && this.barCount > 0) {
        this.reuploadBuffers();
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Get WebGL2 context
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false, // We don't need AA for waveforms
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error('WebGL2 is not supported in this browser');
    }

    this.gl = gl;
    this.init();
  }

  private init(): void {
    const gl = this.gl;

    // Create shader program
    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    if (!this.program) {
      throw new Error('Failed to create shader program');
    }

    // Get uniform locations
    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      barWidth: gl.getUniformLocation(this.program, 'u_barWidth'),
      viewStart: gl.getUniformLocation(this.program, 'u_viewStart'),
      viewEnd: gl.getUniformLocation(this.program, 'u_viewEnd'),
      playhead: gl.getUniformLocation(this.program, 'u_playhead'),
      colorMode: gl.getUniformLocation(this.program, 'u_colorMode'),
    };

    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // Create corner buffer (shared by all instances)
    // Quad corners: bottom-left, bottom-right, top-right, top-left
    const corners = new Float32Array([
      -1, -1,  // bottom-left
      1, -1,   // bottom-right
      1, 1,    // top-right
      -1, -1,  // bottom-left
      1, 1,    // top-right
      -1, 1,   // top-left
    ]);
    this.cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);

    const cornerLoc = gl.getAttribLocation(this.program, 'a_corner');
    gl.enableVertexAttribArray(cornerLoc);
    gl.vertexAttribPointer(cornerLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(cornerLoc, 0); // Not instanced

    // Create instance buffers (will be filled when waveform data is set)
    this.positionBuffer = gl.createBuffer();
    this.lowPeakBuffer = gl.createBuffer();
    this.midPeakBuffer = gl.createBuffer();
    this.highPeakBuffer = gl.createBuffer();

    // Setup instance attributes
    this.setupInstanceAttribute('a_position', this.positionBuffer, 1);
    this.setupInstanceAttribute('a_lowPeak', this.lowPeakBuffer, 1);
    this.setupInstanceAttribute('a_midPeak', this.midPeakBuffer, 1);
    this.setupInstanceAttribute('a_highPeak', this.highPeakBuffer, 1);

    gl.bindVertexArray(null);

    // Create playhead shader program
    this.playheadProgram = this.createProgram(playheadVertSource, playheadFragSource);
    if (this.playheadProgram) {
      this.playheadUniforms = {
        playhead: gl.getUniformLocation(this.playheadProgram, 'u_playhead'),
        viewStart: gl.getUniformLocation(this.playheadProgram, 'u_viewStart'),
        viewEnd: gl.getUniformLocation(this.playheadProgram, 'u_viewEnd'),
        lineWidth: gl.getUniformLocation(this.playheadProgram, 'u_lineWidth'),
      };

      // Create playhead VAO
      this.playheadVao = gl.createVertexArray();
      gl.bindVertexArray(this.playheadVao);

      // Playhead line geometry (vertical line from bottom to top)
      const playheadVertices = new Float32Array([
        -0.5, -1.0,  // bottom-left
        0.5, -1.0,   // bottom-right
        0.5, 1.0,    // top-right
        -0.5, -1.0,  // bottom-left
        0.5, 1.0,    // top-right
        -0.5, 1.0,   // top-left
      ]);

      this.playheadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.playheadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, playheadVertices, gl.STATIC_DRAW);

      const playheadPosLoc = gl.getAttribLocation(this.playheadProgram, 'a_position');
      gl.enableVertexAttribArray(playheadPosLoc);
      gl.vertexAttribPointer(playheadPosLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindVertexArray(null);
    }

    // Set clear color to OLED black
    gl.clearColor(0, 0, 0, 1);

    this.isInitialized = true;
    this.resize();
  }

  private setupInstanceAttribute(name: string, buffer: WebGLBuffer | null, size: number): void {
    const gl = this.gl;
    const location = gl.getAttribLocation(this.program!, name);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(location, 1); // Instanced
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const gl = this.gl;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    // Clean up shaders (they're now part of the program)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);

    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Set the waveform data to render.
   */
  setWaveformData(data: WaveformData | null): void {
    if (!data) {
      this.barCount = 0;
      return;
    }

    const gl = this.gl;
    this.barCount = data.low.length;

    // Pre-allocate typed arrays if needed
    if (!this.positionArray || this.positionArray.length !== this.barCount) {
      this.positionArray = new Float32Array(this.barCount);
      this.lowArray = new Float32Array(this.barCount);
      this.midArray = new Float32Array(this.barCount);
      this.highArray = new Float32Array(this.barCount);
    }

    // Fill position array (normalized 0-1)
    for (let i = 0; i < this.barCount; i++) {
      this.positionArray[i] = i / (this.barCount - 1);
    }

    // Copy peak data
    this.lowArray!.set(data.low);
    this.midArray!.set(data.mid);
    this.highArray!.set(data.high);

    // Upload to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionArray, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lowPeakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lowArray!, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.midPeakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.midArray!, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.highPeakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.highArray!, gl.STATIC_DRAW);
  }

  /**
   * Set the visible range of the waveform.
   */
  setViewRange(start: number, end: number): void {
    this.viewRange = {
      start: Math.max(0, Math.min(1, start)),
      end: Math.max(0, Math.min(1, end)),
    };
  }

  /**
   * Set the playhead position (0-1).
   */
  setPlayheadPosition(position: number): void {
    this.playheadPosition = Math.max(0, Math.min(1, position));
  }

  /**
   * Set the color mode.
   */
  setColorMode(mode: WaveformColorMode): void {
    this.colorMode = mode;
  }

  /**
   * Resize the canvas to match its display size.
   */
  resize(): void {
    const displayWidth = Math.floor(this.canvas.clientWidth * this.devicePixelRatio);
    const displayHeight = Math.floor(this.canvas.clientHeight * this.devicePixelRatio);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }

  /**
   * Re-upload cached waveform data after context restore.
   */
  private reuploadBuffers(): void {
    if (!this.positionArray || !this.lowArray || !this.midArray || !this.highArray) {
      return;
    }

    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionArray, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lowPeakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lowArray, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.midPeakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.midArray, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.highPeakBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.highArray, gl.STATIC_DRAW);
  }

  /**
   * Render the waveform.
   */
  render(): void {
    // Skip rendering if context is lost
    if (this.contextLost) {
      return;
    }

    if (!this.isInitialized || !this.program || this.barCount === 0) {
      // Clear to black even if no data
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      return;
    }

    const gl = this.gl;

    // Clear
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform2f(this.uniforms.resolution!, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.barWidth!, 1.0 / this.barCount);
    gl.uniform1f(this.uniforms.viewStart!, this.viewRange.start);
    gl.uniform1f(this.uniforms.viewEnd!, this.viewRange.end);
    gl.uniform1f(this.uniforms.playhead!, this.playheadPosition);
    gl.uniform1i(this.uniforms.colorMode!, COLOR_MODE_MAP[this.colorMode]);

    // Bind VAO and draw waveform
    gl.bindVertexArray(this.vao);

    // Draw instanced triangles (6 vertices per quad, barCount instances)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.barCount);

    gl.bindVertexArray(null);

    // Draw playhead line (if visible in current view)
    if (
      this.playheadProgram &&
      this.playheadVao &&
      this.playheadPosition >= this.viewRange.start &&
      this.playheadPosition <= this.viewRange.end
    ) {
      gl.useProgram(this.playheadProgram);

      // Line width in clip space (2 pixels)
      const lineWidth = (4 / this.canvas.width) * 2;

      gl.uniform1f(this.playheadUniforms.playhead!, this.playheadPosition);
      gl.uniform1f(this.playheadUniforms.viewStart!, this.viewRange.start);
      gl.uniform1f(this.playheadUniforms.viewEnd!, this.viewRange.end);
      gl.uniform1f(this.playheadUniforms.lineWidth!, lineWidth);

      gl.bindVertexArray(this.playheadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    }
  }

  /**
   * Clean up WebGL resources.
   */
  dispose(): void {
    // Remove context loss event listeners
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    // Skip GL cleanup if context is lost
    if (this.contextLost) {
      this.isInitialized = false;
      return;
    }

    const gl = this.gl;

    // Waveform resources
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.lowPeakBuffer) gl.deleteBuffer(this.lowPeakBuffer);
    if (this.midPeakBuffer) gl.deleteBuffer(this.midPeakBuffer);
    if (this.highPeakBuffer) gl.deleteBuffer(this.highPeakBuffer);
    if (this.cornerBuffer) gl.deleteBuffer(this.cornerBuffer);
    if (this.program) gl.deleteProgram(this.program);

    // Playhead resources
    if (this.playheadVao) gl.deleteVertexArray(this.playheadVao);
    if (this.playheadBuffer) gl.deleteBuffer(this.playheadBuffer);
    if (this.playheadProgram) gl.deleteProgram(this.playheadProgram);

    this.isInitialized = false;
  }
}
