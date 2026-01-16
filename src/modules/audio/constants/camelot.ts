/**
 * Camelot Wheel Mapping
 *
 * Maps standard musical key notation to the Camelot wheel system
 * used by DJs for harmonic mixing.
 *
 * The Camelot system uses a number (1-12) and letter (A/B) format:
 * - A = Minor key
 * - B = Major key
 * - Adjacent numbers are compatible for mixing
 */

export const CAMELOT_WHEEL: Record<string, string> = {
  // Major keys (B = Major)
  'C major': '8B',
  'G major': '9B',
  'D major': '10B',
  'A major': '11B',
  'E major': '12B',
  'B major': '1B',
  'F# major': '2B',
  'Gb major': '2B', // Enharmonic
  'Db major': '3B',
  'C# major': '3B', // Enharmonic
  'Ab major': '4B',
  'G# major': '4B', // Enharmonic
  'Eb major': '5B',
  'D# major': '5B', // Enharmonic
  'Bb major': '6B',
  'A# major': '6B', // Enharmonic
  'F major': '7B',

  // Minor keys (A = Minor)
  'A minor': '8A',
  'E minor': '9A',
  'B minor': '10A',
  'F# minor': '11A',
  'Gb minor': '11A', // Enharmonic
  'C# minor': '12A',
  'Db minor': '12A', // Enharmonic
  'G# minor': '1A',
  'Ab minor': '1A', // Enharmonic
  'D# minor': '2A',
  'Eb minor': '2A', // Enharmonic
  'Bb minor': '3A',
  'A# minor': '3A', // Enharmonic
  'F minor': '4A',
  'C minor': '5A',
  'G minor': '6A',
  'D minor': '7A',
};

/**
 * Convert detected key and scale to Camelot notation.
 *
 * @param key - The detected key (e.g., "C", "F#", "Bb")
 * @param scale - The detected scale ("major" or "minor")
 * @returns Camelot notation (e.g., "8B", "11A") or "Unknown" if not found
 */
export function toCamelot(key: string, scale: string): string {
  // Normalize the input
  const normalizedScale = scale.toLowerCase();
  const lookup = `${key} ${normalizedScale}`;

  return CAMELOT_WHEEL[lookup] || 'Unknown';
}

/**
 * Get compatible keys for harmonic mixing.
 * Compatible keys are: same number (±1), and same letter or relative major/minor.
 */
export function getCompatibleKeys(camelot: string): string[] {
  if (camelot === 'Unknown' || camelot.length < 2) return [];

  const num = parseInt(camelot.slice(0, -1), 10);
  const letter = camelot.slice(-1);

  const compatible: string[] = [];

  // Same number, both letters (relative major/minor)
  compatible.push(`${num}A`, `${num}B`);

  // Adjacent numbers, same letter
  const prev = num === 1 ? 12 : num - 1;
  const next = num === 12 ? 1 : num + 1;
  compatible.push(`${prev}${letter}`, `${next}${letter}`);

  return [...new Set(compatible)];
}
