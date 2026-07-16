import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, LogIn, LogOut, MapPin, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  endAdminSession,
  getAllowedNextStatuses,
  getStatusLabel,
  hasAdminSession,
  isAdminPasswordValid,
  startAdminSession,
  type ReportStatus,
} from '../admin';
import { recordAdminDemoLogin } from '../backend';
import type { AdminReport, AiCaseClassification, JointOperation, ManualRubric, PatrolRouteDraft, ProcedureConfig, Team, WorkOrder } from '../types';
import type { ProcedureTemplateId } from '../workOrderTemplates';
import CoordinationDashboard from './CoordinationDashboard';
import WorkAssignmentCentre from './WorkAssignmentCentre';
import ManualRubricForm from './ManualRubricForm';
import ProcedureConfigPanel from './ProcedureConfigPanel';
import CaseClassificationPanel from './CaseClassificationPanel';
import CaseWorkflowStepper from './CaseWorkflowStepper';
import PatrolPlanner from './PatrolPlanner';

interface AdminTabProps {
  reports: AdminReport[];
  workOrders: WorkOrder[];
  jointOperations: JointOperation[];
  teams: Team[];
  onPatchReport: (reportId: string, patch: Partial<AdminReport>, note?: string) => void;
  onUpdateWorkOrder: (next: WorkOrder) => void;
  onCreateTemplateWorkOrders: (reportId: string, templateId: ProcedureTemplateId) => void;
  onConfirmPatrolRoute: (route: PatrolRouteDraft) => void;
  onResetDemoReports: () => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  reviewing: 'bg-sky-100 text-sky-800',
  classified: 'bg-cyan-100 text-cyan-800',
  field_review_required: 'bg-orange-100 text-orange-800',
  notice_issued: 'bg-violet-100 text-violet-800',
  deadline_expired: 'bg-rose-100 text-rose-800',
  clearance_approved: 'bg-teal-100 text-teal-800',
  scheduled: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  needs_information: 'bg-yellow-100 text-yellow-800',
  duplicate: 'bg-zinc-200 text-zinc-700',
  dismissed: 'bg-zinc-200 text-zinc-700',
};

const TEMPLATE_OPTIONS: Array<{ id: ProcedureTemplateId; label: string }> = [
  { id: 'immediate_danger', label: '即時危險安全處理' },
  { id: 'street_waste', label: '街道棄置物處理' },
  { id: 'public_bike_parking_joint_operation', label: '公共單車泊車處聯合行動' },
];

// 把 13 個處理狀態收攏成 5 個階段組，讓案件篩選一目了然，減少橫向捲動
type CaseStageId = 'all' | 'intake' | 'assessment' | 'notice' | 'clearing' | 'closed';
const CASE_STAGES: Array<{ id: CaseStageId; label: string; statuses: ReportStatus[] }> = [
  { id: 'all', label: '全部', statuses: [] },
  { id: 'intake', label: '新案件', statuses: ['pending', 'reviewing', 'needs_information'] },
  { id: 'assessment', label: '待現場評估', statuses: ['classified', 'field_review_required'] },
  { id: 'notice', label: '告示處理', statuses: ['notice_issued', 'deadline_expired'] },
  { id: 'clearing', label: '清理中', statuses: ['clearance_approved', 'scheduled', 'in_progress'] },
  { id: 'closed', label: '已完結', statuses: ['resolved', 'duplicate', 'dismissed'] },
];

export default function AdminTab({ reports, workOrders, jointOperations, teams, onPatchReport, onUpdateWorkOrder, onCreateTemplateWorkOrders, onConfirmPatrolRoute, onResetDemoReports, onNotify }: AdminTabProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasAdminSession());
  const [password, setPassword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id || null);
  const [statusFilter, setStatusFilter] = useState<CaseStageId>('all');
  const [note, setNote] = useState('');
  const [adminView, setAdminView] = useState<'dashboard' | 'cases' | 'assignment'>('dashboard');
  const [selectedTemplateId, setSelectedTemplateId] = useState<ProcedureTemplateId>('immediate_danger');
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null);

  const visibleReports = useMemo(() => {
    if (statusFilter === 'all') return reports;
    const stage = CASE_STAGES.find((item) => item.id === statusFilter);
    return stage ? reports.filter((report) => stage.statuses.includes(report.status)) : reports;
  }, [reports, statusFilter]);
  const selectedReport = reports.find((report) => report.id === selectedId) || visibleReports[0] || reports[0];
  const selectedReportWorkOrders = selectedReport ? workOrders.filter((order) => order.caseId === selectedReport.id) : [];
  const expectedPassword = import.meta.env.VITE_ADMIN_DEMO_PASSWORD || 'admin2026';

  // tab 上的待辦數量徽章：案件＝未完結的案件；工作分配＝需管理員處理的工作單
  const casesBadge = reports.filter((report) => !['resolved', 'dismissed', 'duplicate'].includes(report.status)).length;
  const assignmentBadge = workOrders.filter((order) => ['draft', 'awaiting_acceptance', 'blocked'].includes(order.status)).length;
  const VIEW_TABS: Array<{ id: 'dashboard' | 'cases' | 'assignment'; label: string; badge: number }> = [
    { id: 'dashboard', label: '統籌儀表板', badge: 0 },
    { id: 'cases', label: '案件處理', badge: casesBadge },
    { id: 'assignment', label: '工作分配', badge: assignmentBadge },
  ];
  const VIEW_TITLES: Record<'dashboard' | 'cases' | 'assignment', string> = {
    dashboard: '跨部門統籌儀表板',
    cases: '案件處理',
    assignment: '工作分配與巡查',
  };

  const handleLogin = () => {
    if (!isAdminPasswordValid(password, expectedPassword)) {
      onNotify('示範密碼不正確。', 'error');
      return;
    }
    startAdminSession();
    setIsAuthenticated(true);
    setPassword('');
    void recordAdminDemoLogin();
    onNotify('已進入管理員示範模式。', 'success');
  };

  const handleLogout = () => {
    endAdminSession();
    setIsAuthenticated(false);
    onNotify('已離開管理員示範模式。', 'info');
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto w-full px-5 py-10">
        <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#006b2c]/10 text-[#006b2c] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900">管理員示範模式</h2>
            <p className="text-xs text-zinc-500 leading-relaxed mt-2">
              此頁只供比賽展示，正式系統須使用政府帳戶、多重驗證及伺服器端角色權限。
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-zinc-600">示範密碼</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleLogin(); }}
              placeholder="請輸入示範密碼"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#006b2c]"
            />
          </label>
          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-xl bg-[#006b2c] hover:bg-[#005320] text-white py-3 text-sm font-bold flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" /> 進入工作台
          </button>
        </section>
      </div>
    );
  }

  return (
    <div id="admintab-root" className="max-w-6xl mx-auto w-full px-5 py-5 space-y-5 pb-24">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-zinc-900">{VIEW_TITLES[adminView]}</h2>
              <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1">示範模式</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">案件處理流程模擬；最終判斷仍由人員作出。</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { onResetDemoReports(); setSelectedId(null); onNotify('示範案件已重設。', 'success'); }}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 重設示範案件
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> 離開
            </button>
          </div>
        </div>
        <nav className="flex gap-2 bg-zinc-100 rounded-2xl p-1" aria-label="管理員檢視切換">
          {VIEW_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setAdminView(tab.id)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                adminView === tab.id ? 'bg-white text-[#006b2c] shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className={`rounded-full text-[10px] font-black px-1.5 min-w-[18px] text-center ${
                  adminView === tab.id ? 'bg-[#006b2c] text-white' : 'bg-zinc-300 text-zinc-700'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {adminView === 'dashboard' && <CoordinationDashboard reports={reports} workOrders={workOrders} jointOperations={jointOperations} onSelectCase={(id) => { setSelectedId(id); setAdminView('cases'); }} onSelectWorkOrder={(id) => { setFocusRequest({ id, nonce: Date.now() }); setAdminView('assignment'); }} />}

      {adminView === 'cases' && <>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CASE_STAGES.map((stage) => {
          const count = stage.id === 'all' ? reports.length : reports.filter((report) => stage.statuses.includes(report.status)).length;
          return (
            <button
              type="button"
              key={stage.id}
              onClick={() => setStatusFilter(stage.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                statusFilter === stage.id ? 'bg-[#006b2c] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {stage.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-5">
        <section className="space-y-3">
          {visibleReports.length === 0 ? (
            <div className="border border-dashed border-zinc-300 rounded-2xl p-8 text-center text-sm text-zinc-500">此狀態暫無案件。</div>
          ) : visibleReports.map((report) => (
            <button
              type="button"
              key={report.id}
              onClick={() => setSelectedId(report.id)}
              className={`w-full text-left bg-white border rounded-2xl p-3 transition-colors ${
                selectedReport?.id === report.id ? 'border-[#006b2c] ring-1 ring-[#006b2c]/20' : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="flex gap-3">
                {report.imageUrl ? (
                  <img src={report.imageUrl} alt="舉報相片" className="w-16 h-16 rounded-xl object-cover bg-zinc-100" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400"><ClipboardList className="w-5 h-5" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-bold text-zinc-900 truncate">{report.location}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLES[report.status]}`}>{getStatusLabel(report.status)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{report.description}</p>
                  <p className="text-[10px] text-zinc-400 mt-1.5">舉報日期：{report.date}</p>
                </div>
              </div>
            </button>
          ))}
        </section>

        <section className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 min-h-[430px]">
          {!selectedReport ? (
            <div className="h-full min-h-[360px] flex items-center justify-center text-sm text-zinc-500">請從左側選擇案件。</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3 justify-between">
                <div>
                  <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLES[selectedReport.status]}`}>{getStatusLabel(selectedReport.status)}</span>
                  <h3 className="text-lg font-black text-zinc-900 mt-2">{selectedReport.location}</h3>
                </div>
                {selectedReport.imageUrl && <img src={selectedReport.imageUrl} alt="案件相片" className="w-24 h-24 rounded-xl object-cover bg-zinc-100" />}
              </div>

              <CaseWorkflowStepper report={selectedReport} workOrders={workOrders} />

              <div className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 leading-relaxed">{selectedReport.description}</div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <MapPin className="w-3.5 h-3.5 text-[#006b2c]" />
                {Number.isFinite(selectedReport.lat) && Number.isFinite(selectedReport.lng)
                  ? `已記錄座標：${selectedReport.lat?.toFixed(5)}, ${selectedReport.lng?.toFixed(5)}`
                  : '未有 GPS 座標，日後不會納入示範優化路線。'}
              </div>

              <CaseClassificationPanel
                report={selectedReport}
                onApply={(classification: AiCaseClassification) => {
                  onPatchReport(selectedReport.id, { aiClassification: classification });
                  onNotify('已保存分類建議，仍需管理員覆核。', 'success');
                }}
                onPatch={(patch) => onPatchReport(selectedReport.id, patch)}
              />

              <ManualRubricForm
                rubric={selectedReport.manualRubric}
                onSave={(manualRubric: ManualRubric) => {
                  onPatchReport(selectedReport.id, {
                    manualRubric: { ...manualRubric, completedBy: 'admin-demo', completedAt: new Date().toISOString() },
                  });
                  onNotify('已保存人工觀察記錄。', 'success');
                }}
              />

              <ProcedureConfigPanel
                selected={selectedReport.procedureConfigSnapshot}
                confirmed={selectedReport.procedureConfirmed}
                onConfirm={(config: ProcedureConfig, deadlineAt) => {
                  onPatchReport(selectedReport.id, { procedureConfigSnapshot: config, procedureConfirmed: true, deadlineAt });
                  onNotify('已確認本次示範程序。', 'success');
                }}
              />

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-black text-zinc-900">建立程序工作單</h4>
                  <p className="text-[11px] text-zinc-600 mt-1">由管理員選擇示範模板；建立後需在工作分配中心逐張確認。</p>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="text-[11px] font-bold text-zinc-600 flex-1 min-w-[220px]">程序模板
                    <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value as ProcedureTemplateId)} disabled={selectedReportWorkOrders.length > 0} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
                      {TEMPLATE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={selectedReportWorkOrders.length > 0} onClick={() => { onCreateTemplateWorkOrders(selectedReport.id, selectedTemplateId); onNotify('已建立示範程序工作單，請在工作分配中心逐張確認。', 'success'); }} className="rounded-xl bg-[#006b2c] px-3 py-2 text-xs font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600">建立工作單</button>
                </div>
                {selectedReportWorkOrders.length > 0 && <p className="text-[11px] font-bold text-zinc-600">此案件已有 {selectedReportWorkOrders.length} 張工作單，為避免重複建立，模板選擇及按鈕已停用。</p>}
              </section>

              {getAllowedNextStatuses(selectedReport.status).length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-600">處理備註（可選）</label>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder="例如：已接收個案、現場已貼告示"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs outline-none focus:ring-2 focus:ring-[#006b2c]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {getAllowedNextStatuses(selectedReport.status).map((nextStatus) => (
                      <button
                        type="button"
                        key={nextStatus}
                        onClick={() => { onPatchReport(selectedReport.id, { status: nextStatus, ...(nextStatus === 'notice_issued' ? { noticeDate: new Date().toISOString().split('T')[0] } : {}) }, note); setNote(''); }}
                        className="rounded-xl bg-[#006b2c] hover:bg-[#005320] text-white px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 標記為「{getStatusLabel(nextStatus)}」
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-black text-zinc-900 mb-3">處理時間線</h4>
                <ol className="space-y-3 border-l-2 border-zinc-100 ml-1 pl-4">
                  {(selectedReport.statusHistory || [{ status: selectedReport.status, at: selectedReport.date, by: 'system' }]).map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#006b2c] border-2 border-white" />
                      <p className="font-bold text-zinc-800">{getStatusLabel(entry.status)}</p>
                      <p className="text-zinc-400 mt-0.5">{entry.at.replace('T', ' ').replace('.000Z', '')} ・ {entry.by}</p>
                      {entry.note && <p className="text-zinc-600 mt-1">{entry.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      </div>
      </>}

      {adminView === 'assignment' && <div className="space-y-5">
        <PatrolPlanner reports={reports} workOrders={workOrders} onConfirm={onConfirmPatrolRoute} />
        <WorkAssignmentCentre reports={reports} workOrders={workOrders} teams={teams} focusRequest={focusRequest} onFocusHandled={() => setFocusRequest(null)} onUpdateWorkOrder={onUpdateWorkOrder} onSelectCase={(id) => { setSelectedId(id); setAdminView('cases'); }} onNotify={onNotify} />
      </div>}
    </div>
  );
}
