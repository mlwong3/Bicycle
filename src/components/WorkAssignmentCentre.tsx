import { useState } from 'react';
import { applyWorkOrderTransition, assignWorkOrder, isWorkOrderReady } from '../workOrders';
import { recommendTeams } from '../assignment';
import type { AdminReport, Team, WorkOrder, WorkOrderStatus } from '../types';

export interface WorkAssignmentCentreProps {
  reports: AdminReport[];
  workOrders: WorkOrder[];
  teams: Team[];
  onUpdateWorkOrder: (next: WorkOrder) => void;
  onSelectCase: (caseId: string) => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

const queues: WorkOrderStatus[] = ['draft', 'awaiting_acceptance', 'scheduled', 'in_progress', 'blocked', 'completed'];
const labels: Record<WorkOrderStatus, string> = {
  draft: '待分配', awaiting_acceptance: '待接收', accepted: '已接收', scheduled: '已排期',
  in_progress: '進行中', blocked: '受阻', completed: '已完成', declined: '已退回', cancelled: '已取消',
};

export function getWorkOrderQueueLabel(status: WorkOrderStatus): string { return labels[status]; }
const REASSIGNABLE_STATUSES: readonly WorkOrderStatus[] = ['draft', 'awaiting_acceptance', 'declined', 'blocked'];
export function canShowReassignment(status: WorkOrderStatus): boolean { return REASSIGNABLE_STATUSES.includes(status); }

export function getAssignmentConfirmationReason(order: WorkOrder, teamId: string, reason: string): string | undefined {
  if (order.assignedTeamId && order.assignedTeamId !== teamId && !reason.trim()) return '重新分配必須填寫理由';
  return undefined;
}

export function getWorkOrderLockReason(order: WorkOrder, allOrders: WorkOrder[], now: Date): string | undefined {
  if (isWorkOrderReady(order, allOrders, now)) return undefined;
  if (!Number.isFinite(now.getTime())) return '無效的目前時間';
  if (order.executableAfter && !Number.isFinite(Date.parse(order.executableAfter))) return '可執行時間資料無效';
  if (order.executableAfter && Date.parse(order.executableAfter) > now.getTime()) return '尚未到可執行時間';
  if (order.prerequisiteWorkOrderIds.some((id) => allOrders.find((item) => item.id === id)?.status !== 'completed')) return '等待前置工作完成';
  if (!order.assignedTeamId) return '尚未確認團隊';
  return '未符合可執行條件';
}

export default function WorkAssignmentCentre({ workOrders, teams, onUpdateWorkOrder, onSelectCase, onNotify }: WorkAssignmentCentreProps) {
  const [queue, setQueue] = useState<WorkOrderStatus>('draft');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [now] = useState(() => new Date());
  const visible = workOrders.filter((order) => order.status === queue || (queue === 'scheduled' && order.status === 'accepted'));

  const update = (order: WorkOrder, next: WorkOrderStatus) => {
    const updated = applyWorkOrderTransition(order, next, 'admin-demo', new Date().toISOString(), reasons[order.id] ?? '', workOrders, now);
    if (updated === order) { onNotify('此操作未符合前置條件、證據或理由要求。', 'warning'); return; }
    onUpdateWorkOrder(updated);
    setReasons({ ...reasons, [order.id]: '' });
    onNotify(`工作單已更新為「${labels[next]}」。`, 'success');
  };

  const confirmTeam = (order: WorkOrder, team: Team) => {
    const reason = reasons[order.id] ?? '';
    const reasonError = getAssignmentConfirmationReason(order, team.id, reason);
    if (reasonError) { onNotify(reasonError, 'warning'); return; }
    const updated = assignWorkOrder(order, team, 'admin-demo', new Date().toISOString(), reason);
    if (updated === order) { onNotify('團隊不符合權責、值勤、地區、職能或設備條件。', 'warning'); return; }
    onUpdateWorkOrder(updated);
    setReasons({ ...reasons, [order.id]: '' });
    onNotify(order.assignedTeamId ? '已記錄人工確認重新分配。' : '已記錄人工確認分配。', 'success');
  };

  return <section className="space-y-3" aria-label="工作分配中心">
    <div className="flex gap-2 overflow-x-auto">
      {queues.map((status) => <button type="button" key={status} onClick={() => setQueue(status)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${queue === status ? 'bg-[#006b2c] text-white' : 'bg-zinc-100 text-zinc-600'}`}>{labels[status]} ({workOrders.filter((o) => o.status === status || (status === 'scheduled' && o.status === 'accepted')).length})</button>)}
    </div>
    {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">目前狀態沒有工作單。</div> : visible.map((order) => {
      const team = teams.find((item) => item.id === order.assignedTeamId);
      const lock = getWorkOrderLockReason(order, workOrders, now);
      const canReassign = Boolean(order.assignedTeamId && canShowReassignment(order.status));
      const recommendations = canReassign || !order.assignedTeamId ? recommendTeams(order, teams, now).slice(0, 3) : [];
      return <article key={order.id} className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between gap-3"><div><h3 className="font-black">{order.title}</h3><button type="button" onClick={() => onSelectCase(order.caseId)} className="text-xs text-[#006b2c] underline">{order.location} ・ {order.leadDepartment}</button></div><span className="text-[11px] font-bold text-zinc-500">{labels[order.status]}</span></div>
        <div className="text-xs text-zinc-600">團隊：{team?.name ?? '尚未分配'}　到期：{order.dueAt?.slice(0, 10) ?? '未設定'}<br />前置：{order.prerequisiteWorkOrderIds.length ? order.prerequisiteWorkOrderIds.join('、') : '無'}{order.blockerReason && <><br /><span className="text-rose-700 font-bold">受阻原因：{order.blockerReason}</span></>}</div>
        {recommendations.length > 0 && <div className="rounded-xl bg-emerald-50 p-3 space-y-2"><p className="text-xs font-black">{canReassign ? '規則推薦／重新分配（人工確認）' : '規則推薦（人工確認）'}</p>{recommendations.map((recommendation) => { const recommendedTeam = teams.find((item) => item.id === recommendation.teamId); const sameTeam = recommendation.teamId === order.assignedTeamId; return <div key={recommendation.teamId} className="flex items-center justify-between gap-2 text-[11px]"><span>{recommendedTeam?.name} · {recommendation.score}分<br /><span className="text-zinc-500">{recommendation.reasons.join('、')}</span></span>{!sameTeam && <button type="button" onClick={() => recommendedTeam && confirmTeam(order, recommendedTeam)} className="rounded-lg bg-[#006b2c] text-white px-2 py-1 font-bold">{canReassign ? '重新分配' : '確認分配'}</button>}</div>; })}</div>}
        {order.evidenceChecklist.length > 0 && <div className="space-y-1"><p className="text-xs font-black">完成證據</p>{order.evidenceChecklist.map((item) => <label key={item.id} className="block text-xs"><input type="checkbox" checked={item.completed} onChange={() => onUpdateWorkOrder({ ...order, evidenceChecklist: order.evidenceChecklist.map((evidence) => evidence.id === item.id ? { ...evidence, completed: !evidence.completed } : evidence) })} className="mr-2" />{item.label}</label>)}</div>}
        {(['awaiting_acceptance', 'in_progress'].includes(queue) || canReassign) && <textarea value={reasons[order.id] ?? ''} onChange={(event) => setReasons({ ...reasons, [order.id]: event.target.value })} placeholder="重新分配／退回／受阻時必須填寫理由" rows={2} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-xs" />}
        <div className="flex flex-wrap gap-2">{queue === 'awaiting_acceptance' && <><button type="button" onClick={() => update(order, 'accepted')} className="btn-action">接收</button><button type="button" onClick={() => update(order, 'declined')} className="btn-action">退回</button></>}{queue === 'scheduled' && order.status === 'accepted' && <button type="button" onClick={() => update(order, 'scheduled')} className="btn-action">排期</button>}{queue === 'scheduled' && order.status === 'scheduled' && !lock && <button type="button" onClick={() => update(order, 'in_progress')} className="btn-action">開始</button>}{queue === 'scheduled' && order.status === 'scheduled' && lock && <span className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-500">已鎖定：{lock}</span>}{queue === 'in_progress' && <><button type="button" disabled={order.evidenceChecklist.some((item) => !item.completed)} onClick={() => update(order, 'completed')} className="btn-action disabled:opacity-40">完成</button><button type="button" onClick={() => update(order, 'blocked')} className="btn-action">受阻</button></>}{queue === 'blocked' && <button type="button" onClick={() => update(order, 'scheduled')} className="btn-action">重新排期</button>}</div>
      </article>;
    })}
  </section>;
}
