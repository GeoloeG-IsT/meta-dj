export interface SmartListRule {
  field: string;
  operator: string;
  value: string;
  logic: string;
}

export const generateSmartListSql = (rules: SmartListRule[]): string => {
  if (rules.length === 0) return "1=1";

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
