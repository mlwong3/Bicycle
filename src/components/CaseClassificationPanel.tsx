import { useState } from 'react';
import { buildAiClassificationInput, classifyReportText } from '../aiClassification';
import type { AdminReport, AiCaseClassification, CaseType, Urgency } from '../types';

interface CaseClassificationPanelProps {
  report: AdminReport;
  onApply: (classification: AiCaseClassification) => void;
  onPatch: (patch: Partial<AdminReport>) => void;
}

export default function CaseClassificationPanel({ report, onApply, onPatch }: CaseClassificationPanelProps) {
  const [suggestion, setSuggestion] = useState<AiCaseClassification | null>(report.aiClassification || null);
  const [loading, setLoading] = useState(false);

  const runClassification = async () => {
    setLoading(true);
    const result = await classifyReportText(buildAiClassificationInput(report));
    setSuggestion(result);
    setLoading(false);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    onApply(suggestion);
    onPatch({ caseType: suggestion.caseType, urgency: suggestion.urgency, assignedDepartment: suggestion.suggestedDepartment || undefined });
  };

  return (
    <div className="rounded-xl border border-zinc-200 p-3 space-y-3">
      <div className="flex justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-zinc-900">案件分類建議</h4>
          <p className="text-[11px] text-zinc-500 mt-1">只處理文字及欄位，不分析相片。</p>
        </div>
        <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-1 h-fit font-bold">僅供參考</span>
      </div>
      <button type="button" onClick={() => void runClassification()} disabled={loading} className="w-full rounded-xl bg-sky-700 text-white py-2.5 text-xs font-bold disabled:opacity-60">
        {loading ? '整理中…' : '產生文字分類建議'}
      </button>
      {suggestion && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-lg bg-zinc-50 p-2 text-zinc-600">分類
              <select value={suggestion.caseType} onChange={(event) => setSuggestion({ ...suggestion, caseType: event.target.value as CaseType })} className="mt-1 w-full bg-transparent font-bold text-zinc-900">
                <option value="obstruction">阻塞</option><option value="illegal_parking">違規停泊</option><option value="suspected_abandoned">疑似棄置</option><option value="damaged_bicycle">單車破損</option><option value="safety_hazard">安全問題</option><option value="other">其他</option>
              </select>
            </label>
            <label className="rounded-lg bg-zinc-50 p-2 text-zinc-600">緊急程度
              <select value={suggestion.urgency} onChange={(event) => setSuggestion({ ...suggestion, urgency: event.target.value as Urgency })} className="mt-1 w-full bg-transparent font-bold text-zinc-900">
                <option value="emergency">緊急</option><option value="urgent">優先</option><option value="normal">一般</option>
              </select>
            </label>
          </div>
          <p className="text-zinc-600">理由：{suggestion.rationale.join(' ')}</p>
          <p className="text-zinc-500">信心度：{suggestion.confidence} ・ 建議：{suggestion.suggestedAction}</p>
          {suggestion.missingInformation.length > 0 && <p className="text-amber-700">需要補充：{suggestion.missingInformation.join('、')}</p>}
          <button type="button" onClick={applySuggestion} className="w-full rounded-xl border border-[#006b2c] text-[#006b2c] py-2.5 text-xs font-bold hover:bg-[#006b2c]/5">接受／保存分類建議</button>
        </div>
      )}
    </div>
  );
}
