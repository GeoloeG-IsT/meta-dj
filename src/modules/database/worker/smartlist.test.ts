import { describe, it, expect } from 'vitest';
import { generateSmartListSql } from './smartlist';

describe('Smartlist SQL Generation', () => {
  it('should generate a simple equality WHERE clause', () => {
    const rules = [
      { field: 'genre', operator: '=', value: 'House', logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    expect(sql).toBe("genre = 'House'");
  });

  it('should handle numeric comparisons', () => {
    const rules = [
      { field: 'bpm', operator: '>', value: '120', logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    expect(sql).toBe("bpm > 120");
  });

  it('should combine multiple rules with AND', () => {
    const rules = [
      { field: 'bpm', operator: '>', value: '120', logic: 'AND' },
      { field: 'genre', operator: '=', value: 'House', logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    expect(sql).toBe("bpm > 120 AND genre = 'House'");
  });

  it('should combine rules with mixed logic (AND/OR)', () => {
    const rules = [
      { field: 'bpm', operator: '>', value: '120', logic: 'AND' },
      { field: 'genre', operator: '=', value: 'House', logic: 'OR' },
      { field: 'rating', operator: '>=', value: '4', logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    // Note: The structure of rules usually implies (Rule 1) LOGIC (Rule 2) LOGIC (Rule 3)
    // We'll follow the sequential order for now.
    expect(sql).toBe("bpm > 120 OR genre = 'House' AND rating >= 4");
  });

  it('should handle CONTAINS with LIKE', () => {
    const rules = [
      { field: 'title', operator: 'CONTAINS', value: 'Deep', logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    expect(sql).toBe("title LIKE '%Deep%'");
  });

  it('should return 1=1 for empty rules', () => {
    expect(generateSmartListSql([])).toBe("1=1");
  });
});
