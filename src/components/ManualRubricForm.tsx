import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ManualRubric, RubricObservation } from '../types';

const RUBRIC_FIELDS: Array<{ key: keyof ManualRubric; label: string }> = [
  { key: 'rust', label: '鏽蝕' },
  { key: 'tire', label: '輪胎' },
  { key: 'dust', label: '積塵' },
  { key: 'attachment', label: '附著物' },
  { key: 'missing', label: '零件缺失' },
  { key: 'lock', label: '車鎖狀態' },
];

function emptyObservation(): RubricObservation {
  return { score: null, observable: false };
}

export function createEmptyRubric(): ManualRubric {
  return { rust: emptyObservation(), tire: emptyObservation(), dust: emptyObservation(), attachment: emptyObservation(), missing: emptyObservation(), lock: emptyObservation() };
}

interface ManualRubricFormProps {
  rubric?: ManualRubric;
  onSave: (rubric: ManualRubric) => void;
}

export default function ManualRubricForm({ rubric, onSave }: ManualRubricFormProps) {
  const [draft, setDraft] = useState<ManualRubric>(() => rubric || createEmptyRubric());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDraft(rubric || createEmptyRubric());
  }, [rubric]);

  const updateObservation = (key: keyof ManualRubric, value: RubricObservation) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  // 是否已有評分，用於收合狀態下顯示「已評分」提示
  const hasScores = RUBRIC_FIELDS.some(({ key }) => draft[key].observable && draft[key].score !== null);

  return (
    <div className="rounded-2xl border border-zinc-200">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-zinc-900">評分</h4>
            {hasScores && <span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5">已評分</span>}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">人工相片觀察評分；不可觀察請選「看不到」，不會當作 0 分。</p>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3">
      <div className="space-y-2">
        {RUBRIC_FIELDS.map(({ key, label }) => {
          const observation = draft[key];
          return (
            <div key={key} className="rounded-xl border border-zinc-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-800">{label}</span>
                <span className="text-[10px] text-zinc-400">{observation.observable ? '可觀察' : '不可觀察'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3].map((score) => (
                  <button
                    type="button"
                    key={score}
                    onClick={() => updateObservation(key, { score: score as 0 | 1 | 2 | 3, observable: true, note: observation.note })}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${observation.observable && observation.score === score ? 'bg-[#006b2c] text-white' : 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {score} 分
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateObservation(key, { score: null, observable: false, note: observation.note })}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${!observation.observable ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  看不到
                </button>
              </div>
              <input
                value={observation.note || ''}
                onChange={(event) => updateObservation(key, { ...observation, note: event.target.value })}
                placeholder="觀察備註（可選）"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[11px] outline-none focus:ring-2 focus:ring-[#006b2c]"
              />
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => onSave(draft)} className="w-full rounded-xl bg-zinc-900 text-white py-2.5 text-xs font-bold hover:bg-zinc-700">
        保存人工觀察
      </button>
        </div>
      )}
    </div>
  );
}
