import { describe, it, expect } from 'vitest';
import { generateSmartListSql, validateRule } from './smartlist';

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

  it('should support dateAdded field', () => {
    const rules = [
      { field: 'dateAdded', operator: '>', value: '2024-01-01', logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    expect(sql).toBe("dateAdded > '2024-01-01'");
  });
});

describe('Smartlist Security - SQL Injection Prevention', () => {
  it('should reject invalid field names (SQL injection attempt)', () => {
    const maliciousRule = {
      field: 'id; DROP TABLE Track; --',
      operator: '=',
      value: '1',
      logic: 'AND'
    };
    expect(() => generateSmartListSql([maliciousRule])).toThrow('Invalid field');
  });

  it('should reject invalid operators (SQL injection attempt)', () => {
    const maliciousRule = {
      field: 'bpm',
      operator: '= 1 OR 1=1; --',
      value: '120',
      logic: 'AND'
    };
    expect(() => generateSmartListSql([maliciousRule])).toThrow('Invalid operator');
  });

  it('should reject invalid logic operators', () => {
    const maliciousRule = {
      field: 'bpm',
      operator: '>',
      value: '120',
      logic: 'AND; DROP TABLE Track; --'
    };
    expect(() => generateSmartListSql([maliciousRule])).toThrow('Invalid logic');
  });

  it('should escape single quotes in values', () => {
    const rules = [
      { field: 'title', operator: '=', value: "Track's Name", logic: 'AND' }
    ];
    const sql = generateSmartListSql(rules);
    expect(sql).toBe("title = 'Track''s Name'");
  });

  it('should validate rules correctly', () => {
    expect(validateRule({ field: 'bpm', operator: '>', value: '120', logic: 'AND' })).toEqual({ valid: true });
    expect(validateRule({ field: 'invalid', operator: '>', value: '120', logic: 'AND' }).valid).toBe(false);
    expect(validateRule({ field: 'bpm', operator: 'INVALID', value: '120', logic: 'AND' }).valid).toBe(false);
    expect(validateRule({ field: 'bpm', operator: '>', value: '120', logic: 'INVALID' }).valid).toBe(false);
  });
});
