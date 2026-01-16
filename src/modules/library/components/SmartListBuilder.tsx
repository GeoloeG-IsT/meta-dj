import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { playlistService, type SmartListRule } from '../services/playlist.service';

interface SmartListBuilderProps {
  playlistId: number;
  playlistTitle: string;
  onClose: () => void;
  onSave: () => void;
}

const FIELD_OPTIONS = [
  { value: 'bpm', label: 'BPM' },
  { value: 'key', label: 'Key' },
  { value: 'genre', label: 'Genre' },
  { value: 'rating', label: 'Rating' },
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
];

const OPERATOR_OPTIONS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'at least' },
  { value: '<=', label: 'at most' },
  { value: 'CONTAINS', label: 'contains' },
];

const LOGIC_OPTIONS = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' },
];

const createEmptyRule = (): SmartListRule => ({
  field: 'bpm',
  operator: '>',
  value: '',
  logic: 'AND',
});

export const SmartListBuilder: React.FC<SmartListBuilderProps> = ({
  playlistId,
  playlistTitle,
  onClose,
  onSave,
}) => {
  const [rules, setRules] = useState<SmartListRule[]>([createEmptyRule()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    const loadRules = async () => {
      setIsLoading(true);
      try {
        const existingRules = await playlistService.getSmartListRules(playlistId);
        if (existingRules.length > 0) {
          setRules(existingRules);
        }
      } catch (e) {
        console.error('Failed to load smartlist rules:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadRules();
  }, [playlistId]);

  const handleAddRule = () => {
    setRules([...rules, createEmptyRule()]);
  };

  const handleRemoveRule = (index: number) => {
    if (rules.length > 1) {
      setRules(rules.filter((_, i) => i !== index));
    }
  };

  const handleRuleChange = (index: number, field: keyof SmartListRule, value: string) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await playlistService.saveSmartListRules(playlistId, rules);
      setMatchCount(result.trackCount);
      onSave();
    } catch (e) {
      console.error('Failed to save smartlist rules:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#0a0a0a] border border-[#4DFA90]/20 rounded-sm w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#4DFA90]/10">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4DFA90]">
              Smartlist Rules
            </h2>
            <p className="text-[9px] text-white/40 mt-1">{playlistTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-[#4DFA90]" size={24} />
            </div>
          ) : (
            rules.map((rule, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-[#121212] p-3 rounded-sm border border-[#4DFA90]/10"
              >
                {/* Logic (AND/OR) - shown only for rules after the first */}
                {index > 0 && (
                  <select
                    value={rule.logic}
                    onChange={(e) => handleRuleChange(index, 'logic', e.target.value)}
                    className="bg-[#1a1a1a] border border-[#4DFA90]/20 text-[9px] text-[#4DFA90] uppercase font-bold px-2 py-1.5 rounded-sm focus:outline-none focus:border-[#4DFA90]/50"
                  >
                    {LOGIC_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {/* Field */}
                <select
                  value={rule.field}
                  onChange={(e) => handleRuleChange(index, 'field', e.target.value)}
                  className="bg-[#1a1a1a] border border-[#4DFA90]/20 text-[10px] text-white/80 px-2 py-1.5 rounded-sm focus:outline-none focus:border-[#4DFA90]/50 min-w-[80px]"
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={rule.operator}
                  onChange={(e) => handleRuleChange(index, 'operator', e.target.value)}
                  className="bg-[#1a1a1a] border border-[#4DFA90]/20 text-[10px] text-white/80 px-2 py-1.5 rounded-sm focus:outline-none focus:border-[#4DFA90]/50 min-w-[100px]"
                >
                  {OPERATOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Value */}
                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                  placeholder="Value..."
                  className="flex-1 bg-[#1a1a1a] border border-[#4DFA90]/20 text-[10px] text-white/80 px-2 py-1.5 rounded-sm focus:outline-none focus:border-[#4DFA90]/50 placeholder:text-white/20"
                />

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveRule(index)}
                  disabled={rules.length === 1}
                  className="text-white/30 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#4DFA90]/10 flex items-center justify-between">
          <button
            onClick={handleAddRule}
            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[#4DFA90]/60 hover:text-[#4DFA90] transition-colors"
          >
            <Plus size={12} />
            Add Rule
          </button>

          <div className="flex items-center gap-4">
            {matchCount !== null && (
              <span className="text-[9px] text-white/40">
                {matchCount} track{matchCount !== 1 ? 's' : ''} matched
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || rules.some((r) => r.value === '')}
              className="flex items-center gap-2 bg-[#4DFA90] text-black text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-[#3de080] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={12} />
              ) : (
                <Save size={12} />
              )}
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
