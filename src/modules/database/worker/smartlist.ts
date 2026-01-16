export interface SmartListRule {
  field: string;
  operator: string;
  value: string;
  logic: string;
}

// Whitelist of valid field names (must match Track table columns)
const VALID_FIELDS = new Set([
  'bpm', 'key', 'genre', 'rating', 'title', 'artist', 'album', 'dateAdded'
]);

// Whitelist of valid SQL operators
const VALID_OPERATORS = new Set([
  '=', '!=', '>', '<', '>=', '<=', 'CONTAINS'
]);

// Whitelist of valid logic operators
const VALID_LOGIC = new Set(['AND', 'OR']);

export const validateRule = (rule: SmartListRule): { valid: boolean; error?: string } => {
  if (!VALID_FIELDS.has(rule.field)) {
    return { valid: false, error: `Invalid field: ${rule.field}` };
  }
  if (!VALID_OPERATORS.has(rule.operator)) {
    return { valid: false, error: `Invalid operator: ${rule.operator}` };
  }
  if (!VALID_LOGIC.has(rule.logic)) {
    return { valid: false, error: `Invalid logic: ${rule.logic}` };
  }
  return { valid: true };
};

export const generateSmartListSql = (rules: SmartListRule[]): string => {
  if (rules.length === 0) return "1=1";

  // Validate all rules before generating SQL
  for (const rule of rules) {
    const validation = validateRule(rule);
    if (!validation.valid) {
      throw new Error(`SQL generation failed: ${validation.error}`);
    }
  }

  return rules.reduce((acc, rule, index) => {
    const operator = rule.operator === "CONTAINS" ? "LIKE" : rule.operator;
    const escapedValue = rule.value.replace(/'/g, "''");
    const value = rule.operator === "CONTAINS"
      ? `'%${escapedValue}%'`
      : (isNaN(Number(rule.value)) || rule.value === "" ? `'${escapedValue}'` : rule.value);

    const clause = `${rule.field} ${operator} ${value}`;

    if (index === 0) {
      return clause;
    } else {
      return `${acc} ${rule.logic} ${clause}`;
    }
  }, "");
};
