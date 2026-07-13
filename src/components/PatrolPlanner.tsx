import { useMemo, useState } from 'react';
import { buildPatrolOrder } from '../patrol';
import type { AdminReport, PatrolOptions, PatrolRouteDraft } from '../types';

interface PatrolPlannerProps {
  reports: AdminReport[];
  onConfirm: (route: PatrolRouteDraft) => void;
}

export default function PatrolPlanner({ reports, onConfirm }: PatrolPlannerProps) {
  const [travelMode, setTravelMode] = useState<PatrolOptions['travelMode']>('inspection-walking');
  const [maxStops, setMaxStops] = useState(5);
  const [route, setRoute] = useState<PatrolRouteDraft | null>(null);
  const eligibleCount = useMemo(() => reports.filter((report) => report.status === 'clearance_approved' && report.coordinatesValid && report.procedureConfirmed && !report.isDuplicate).length, [reports]);

  const generate = () => {
    setRoute(buildPatrolOrder({ lat: 22.38, lng: 114.18 }, reports, {
      travelMode,
      maxStops,
      serviceMinutesPerStop: 12,
      routeSource: 'straight-line-estimate',
    }));
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black text-zinc-900">示範巡查次序建議</h3>
          <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-1 font-bold">Prototype Simulation</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">只納入已完成程序確認及有有效座標的案件，目前候選 {eligibleCount} 宗。</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-zinc-600">任務模式
          <select value={travelMode} onChange={(event) => setTravelMode(event.target.value as PatrolOptions['travelMode'])} className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs">
            <option value="inspection-walking">步行巡查</option>
            <option value="inspection-driving">一般駕駛巡查</option>
            <option value="clearance-vehicle">清理車輛示範</option>
          </select>
        </label>
        <label className="text-[11px] text-zinc-600">最多案件數
          <select value={maxStops} onChange={(event) => setMaxStops(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs">
            {[5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} 宗</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={generate} className="w-full rounded-xl bg-[#006b2c] text-white py-2.5 text-xs font-bold hover:bg-[#005320]">產生巡查次序</button>
      {route && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-zinc-50 p-2"><p className="text-zinc-500">案件</p><p className="font-black text-zinc-900">{route.reportIds.length} 宗</p></div>
            <div className="rounded-lg bg-zinc-50 p-2"><p className="text-zinc-500">估算距離</p><p className="font-black text-zinc-900">{route.estimatedDistanceKm} km</p></div>
            <div className="rounded-lg bg-zinc-50 p-2"><p className="text-zinc-500">估算時間</p><p className="font-black text-zinc-900">{route.estimatedTravelMinutesRange.min}–{route.estimatedTravelMinutesRange.max} 分</p></div>
          </div>
          <ol className="space-y-1.5">
            {route.orderedStops.map((stop) => <li key={stop.reportId} className="rounded-lg bg-zinc-50 px-3 py-2 flex justify-between"><span>{stop.order}. {reports.find((report) => report.id === stop.reportId)?.location || stop.reportId}</span><span className="text-zinc-500">優先度 {stop.priorityScore}</span></li>)}
          </ol>
          <p className="text-amber-700 leading-relaxed">本結果為示範性巡查次序，不代表實際最短路線、正式派工或法律程序結果；估算時間不包括現場處理、泊車及搬運。</p>
          <button type="button" disabled={route.reportIds.length === 0} onClick={() => onConfirm(route)} className="w-full rounded-xl border border-[#006b2c] text-[#006b2c] py-2.5 font-bold disabled:opacity-40">確認巡查次序</button>
        </div>
      )}
    </section>
  );
}
