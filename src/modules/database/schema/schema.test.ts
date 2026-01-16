import { describe, it, expect } from 'vitest';
import schemaSql from './engine-dj-schema.sql?raw';

describe('Database Schema', () => {
  it('should include isSmartList column in Playlist table', () => {
    expect(schemaSql).toContain('isSmartList BOOLEAN DEFAULT 0');
  });

  it('should include SmartListRule table', () => {
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS SmartListRule');
  });
});
