/**
 * RubberbandLoader - WASM module loader for Rubberband time-stretching
 *
 * Handles fetching, compiling, and initializing the Rubberband WASM module.
 * Provides a singleton loader to ensure the module is only loaded once.
 *
 * Usage:
 * ```typescript
 * const rubberband = await RubberbandLoader.initialize('/rubberband.wasm');
 * const state = rubberband.rubberband_new(44100, 2, options, 1.0, 1.0);
 * ```
 */

import { RubberBandInterface } from 'rubberband-wasm';

/** Default WASM path in public folder */
export const DEFAULT_WASM_PATH = '/rubberband.wasm';

/**
 * RubberbandLoader - Singleton WASM loader for Rubberband
 */
class RubberbandLoaderClass {
  private instance: RubberBandInterface | null = null;
  private loadPromise: Promise<RubberBandInterface> | null = null;

  /**
   * Initialize the Rubberband WASM module
   *
   * @param wasmPath - Path to the rubberband.wasm file (default: /rubberband.wasm)
   * @returns Promise resolving to RubberBandInterface instance
   * @throws Error if fetch or compilation fails
   */
  async initialize(wasmPath: string = DEFAULT_WASM_PATH): Promise<RubberBandInterface> {
    // Return cached instance if available
    if (this.instance) {
      return this.instance;
    }

    // Return existing load promise if in progress
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.loadPromise = this.loadModule(wasmPath);

    try {
      this.instance = await this.loadPromise;
      return this.instance;
    } catch (error) {
      // Clear load promise on failure to allow retry
      this.loadPromise = null;
      throw error;
    }
  }

  /**
   * Check if the module is loaded
   */
  isLoaded(): boolean {
    return this.instance !== null;
  }

  /**
   * Get the loaded instance (throws if not loaded)
   */
  getInstance(): RubberBandInterface {
    if (!this.instance) {
      throw new Error('RubberbandLoader not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  /**
   * Dispose of the loaded instance
   */
  dispose(): void {
    this.instance = null;
    this.loadPromise = null;
  }

  /**
   * Load and compile the WASM module
   */
  private async loadModule(wasmPath: string): Promise<RubberBandInterface> {
    // Fetch the WASM binary
    const response = await fetch(wasmPath);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Rubberband WASM: ${response.status} ${response.statusText}`
      );
    }

    const wasmBinary = await response.arrayBuffer();

    // Compile the WASM module
    const wasmModule = await WebAssembly.compile(wasmBinary);

    // Initialize RubberBandInterface with the compiled module
    const instance = await RubberBandInterface.initialize(wasmModule);

    console.log('[RubberbandLoader] WASM module loaded successfully');

    return instance;
  }
}

// Export singleton instance
export const RubberbandLoader = new RubberbandLoaderClass();

// Re-export types from rubberband-wasm for convenience
export { RubberBandInterface, RubberBandOption, type RubberBandState } from 'rubberband-wasm';
