import { useMemo, useState } from 'react';
import { buildDashboardView, type DashboardView } from '../dashboard';
import type { AdminReport, DashboardFilters, DepartmentCode, JointOperation, WorkOrder, WorkOrderStatus } from '../types';

export interface CoordinationDashboardProps {
  reports: AdminReport[];
  workOrders: WorkOrder[];
  jointOperations: JointOperation[];
  onSelectCase: (caseId: string) => void;
  onSelectWorkOrder: (workOrderId: string) => void;
}

const departments: Array<DepartmentCode | 'all'> = ['all', 'HAD', 'TD', 'LandsD', 'FEHD', 'HKPF'];
const statuses: Array<WorkOrderStatus | 'all'> = ['all', 'draft', 'awaiting_acceptance', 'accepted', 'scheduled', 'in_progress', 'blocked', 'completed', 'declined', 'cancelled'];
const statusLabels: Record<string, string> = { all: '全部狀態', draft: '待分配', awaiting_acceptance: '待接收', accepted: '已接收', scheduled: '已排期', in_progress: '進行中', blocked: '受阻', completed: '已完成', declined: '已退回', cancelled: '已取消' };
const departmentLabels: Record<string, string> = { all: '全部部門', HAD: '民政事務總署', TD: '運輸署', LandsD: '地政總署', FEHD: '食環署', HKPF: '香港警務處' };

function defaultDate(orders: WorkOrder[]): string {
  return [...orders].map((order) => (order.scheduledAt ?? order.createdAt).slice(0, 10)).sort()[0] ?? '';
}

function FilterBar({ filters, onChange }: { filters: DashboardFilters; onChange: (filters: DashboardFilters) => void }) {
  const districts = ['all', ...new Set(['沙田', '大埔', '南區', ...([] as string[])])];
  return <div className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-wrap gap-2" aria-label="儀表板篩選器">
    <select aria-label="地區" value={filters.district} onChange={(e) => onChange({ ...filters, district: e.target.value })} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold">{districts.map((d) => <option key={d} value={d}>{d === 'all' ? '全部地區' : d}</option>)}</select>
    <select aria-label="部門" value={filters.department} onChange={(e) => onChange({ ...filters, department: e.target.value as DashboardFilters['department'] })} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold">{departments.map((d) => <option key={d} value={d}>{departmentLabels[d]}</option>)}</select>
    <input aria-label="日期" type="date" value={filters.date} onChange={(e) => onChange({ ...filters, date: e.target.value })} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold" />
    <select aria-label="狀態" value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as DashboardFilters['status'] })} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold">{statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select>
  </div>;
}

function SummaryCards({ summary, onSelect }: { summary: DashboardView['summary']; onSelect: (key: keyof DashboardView['summary']) => void }) {
  const cards: Array<[keyof DashboardView['summary'], string, number, string]> = [
    ['unclassifiedCases', '待分類案件', summary.unclassifiedCases, 'text-amber-700'], ['immediateDanger', '即時危險', summary.immediateDanger, 'text-rose-700'], ['awaitingAcceptance', '待接收工作', summary.awaitingAcceptance, 'text-sky-700'], ['scheduled', '已排期工作', summary.scheduled, 'text-indigo-700'], ['blockedOrOverdue', '受阻／逾期', summary.blockedOrOverdue, 'text-orange-700'], ['todayJointOperations', '今日聯合行動', summary.todayJointOperations, 'text-emerald-700'],
  ];
  return <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{cards.map(([key, label, value, color]) => <button type="button" key={key} onClick={() => onSelect(key)} className="text-left bg-white border border-zinc-200 rounded-2xl p-3 hover:border-[#006b2c]"><p className="text-[11px] font-bold text-zinc-500">{label}</p><p className={`text-2xl font-black mt-1 ${color}`}>{value}</p></button>)}</div>;
}

function PriorityList({ view, onSelect }: { view: DashboardView; onSelect: (id: string) => void }) {
  return <section className="bg-white border border-zinc-200 rounded-2xl p-4"><h3 className="font-black text-zinc-900">優先工作清單</h3>{view.priorityItems.length === 0 ? <p className="text-sm text-zinc-500 mt-4">目前篩選條件下沒有優先工作。</p> : <div className="mt-3 space-y-2">{view.priorityItems.slice(0, 8).map((item) => <button type="button" key={item.workOrderId} onClick={() => onSelect(item.workOrderId)} className="w-full text-left rounded-xl bg-zinc-50 hover:bg-emerald-50 p-3"><div className="flex justify-between gap-2"><span className="text-xs font-black">#{item.rank} {item.workOrderId}</span><span className="text-[11px] text-rose-700 font-bold">{item.reason}</span></div><p className="text-[11px] text-zinc-500 mt-1">案件：{item.caseId}</p></button>)}</div>}</section>;
}

function Readiness({ items }: { items: DashboardView['operationReadiness'] }) { return <section className="bg-white border border-zinc-200 rounded-2xl p-4"><h3 className="font-black">聯合行動準備程度</h3>{items.length === 0 ? <p className="text-sm text-zinc-500 mt-4">目前篩選條件下沒有聯合行動。</p> : <div className="mt-3 space-y-2">{items.map((item) => <div key={item.jointOperationId} className="flex justify-between rounded-xl bg-zinc-50 p-3 text-xs"><span className="font-bold">{item.jointOperationId}</span><span className={item.ready ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{item.completed}/{item.mandatory} {item.ready ? '已準備' : '待完成'}</span></div>)}</div>}</section>; }
function Loads({ loads }: { loads: DashboardView['departmentLoads'] }) { return <section className="bg-white border border-zinc-200 rounded-2xl p-4 overflow-x-auto"><h3 className="font-black">部門工作量</h3><table className="w-full mt-3 text-[11px]"><thead><tr className="text-left text-zinc-500"><th>部門</th><th>待接收</th><th>排期</th><th>進行</th><th>受阻</th><th>今日完成</th></tr></thead><tbody>{departments.slice(1).map((d) => { const l = loads[d as DepartmentCode]; return <tr key={d} className="border-t border-zinc-100"><td className="py-2 font-bold">{d}</td><td>{l.awaitingAcceptance}</td><td>{l.scheduled}</td><td>{l.inProgress}</td><td>{l.blocked}</td><td>{l.completedToday}</td></tr>; })}</tbody></table></section>; }
function TodayActions({ ids, orders, onSelect }: { ids: string[]; orders: WorkOrder[]; onSelect: (id: string) => void }) { return <section className="bg-white border border-zinc-200 rounded-2xl p-4"><h3 className="font-black">今日可執行工作</h3>{ids.length === 0 ? <p className="text-sm text-zinc-500 mt-4">目前篩選條件下沒有可執行工作。</p> : <div className="mt-3 space-y-2">{ids.map((id) => <button type="button" key={id} onClick={() => onSelect(id)} className="block w-full text-left rounded-xl bg-emerald-50 p-3 text-xs font-bold">{orders.find((order) => order.id === id)?.title ?? id}</button>)}</div>}</section>; }

export default function CoordinationDashboard({ reports, workOrders, jointOperations, onSelectCase, onSelectWorkOrder }: CoordinationDashboardProps) {
  const [filters, setFilters] = useState<DashboardFilters>({ district: 'all', department: 'all', date: defaultDate(workOrders), status: 'all' });
  const now = useMemo(() => new Date(), []);
  const view = useMemo(() => buildDashboardView(reports, workOrders, jointOperations, filters, now), [reports, workOrders, jointOperations, filters, now]);
  return <section className="space-y-4" aria-label="跨部門統籌儀表板">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">原型示範資料｜不代表真實政府案件或部門績效</div>
    <FilterBar filters={filters} onChange={setFilters} />
    <SummaryCards summary={view.summary} onSelect={(key) => { if (key === 'blockedOrOverdue') setFilters({ ...filters, status: 'blocked' }); else if (key === 'awaitingAcceptance') setFilters({ ...filters, status: 'awaiting_acceptance' }); else if (key === 'scheduled') setFilters({ ...filters, status: 'scheduled' }); }} />
    <div className="grid xl:grid-cols-2 gap-4"><PriorityList view={view} onSelect={onSelectWorkOrder} /><Readiness items={view.operationReadiness} /><Loads loads={view.departmentLoads} /><TodayActions ids={view.todayExecutableWorkOrderIds} orders={workOrders} onSelect={onSelectWorkOrder} /></div>
  </section>;
}
