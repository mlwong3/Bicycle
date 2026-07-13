import { useMemo, useState } from 'react';
import { calculateDeadline, createProcedureSnapshot, DEFAULT_PROCEDURES } from '../procedureConfig';
import type { ProcedureConfig } from '../types';

interface ProcedureConfigPanelProps {
  selected?: ProcedureConfig;
  confirmed: boolean;
  onConfirm: (config: ProcedureConfig, deadlineAt: string | undefined) => void;
}

export default function ProcedureConfigPanel({ selected, confirmed, onConfirm }: ProcedureConfigPanelProps) {
  const [selectedId, setSelectedId] = useState(selected?.id || DEFAULT_PROCEDURES[0].id);
  const config = useMemo(() => DEFAULT_PROCEDURES.find((item) => item.id === selectedId) || DEFAULT_PROCEDURES[0], [selectedId]);
  const deadline = calculateDeadline(config, new Date());

  return (
    <div className="rounded-xl border border-zinc-200 p-3 space-y-3">
      <div>
        <h4 className="text-sm font-black text-zinc-900">程序確認</h4>
        <p className="text-[11px] text-zinc-500 mt-1">期限為本次示範設定，並非固定法律規定。</p>
      </div>
      <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
        {DEFAULT_PROCEDURES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-600">
        <div className="rounded-lg bg-zinc-50 p-2">負責部門：{config.responsibleDepartment}</div>
        <div className="rounded-lg bg-zinc-50 p-2">通知時限：{config.noticePeriodHours ? `${config.noticePeriodHours} 小時` : '不設定'}</div>
      </div>
      {deadline && <p className="text-[11px] text-zinc-500">按現在時間計算的示範期限：{deadline.replace('T', ' ').replace('.000Z', '')}</p>}
      <button type="button" onClick={() => onConfirm(createProcedureSnapshot(config), deadline || undefined)} className="w-full rounded-xl bg-[#006b2c] text-white py-2.5 text-xs font-bold hover:bg-[#005320]">
        {confirmed ? '重新確認本次程序' : '確認本次程序'}
      </button>
    </div>
  );
}
