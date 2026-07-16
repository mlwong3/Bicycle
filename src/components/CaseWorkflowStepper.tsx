import { Check } from 'lucide-react';
import type { AdminReport, WorkOrder } from '../types';

export interface CaseWorkflowStep {
  key: string;
  label: string;
  done: boolean;
}

export interface CaseWorkflowStepperProps {
  report: AdminReport;
  workOrders: WorkOrder[];
}

// 依案件資料推導五個處理步驟的完成狀態，供詳情面板頂部進度條使用
export function getCaseWorkflowSteps(report: AdminReport, workOrders: WorkOrder[]): CaseWorkflowStep[] {
  const caseOrders = workOrders.filter((order) => order.caseId === report.id);
  return [
    { key: 'classify', label: '分類', done: Boolean(report.aiClassification) },
    { key: 'field', label: '現場評估', done: Boolean(report.manualRubric?.completedAt) },
    { key: 'procedure', label: '程序確認', done: report.procedureConfirmed },
    { key: 'workorder', label: '工作單', done: caseOrders.length > 0 },
    { key: 'done', label: '完成', done: report.status === 'resolved' },
  ];
}

// 目前步驟＝第一個未完成的步驟；全部完成時停在最後一步
export function getCurrentStepIndex(steps: CaseWorkflowStep[]): number {
  const firstIncomplete = steps.findIndex((step) => !step.done);
  return firstIncomplete === -1 ? steps.length - 1 : firstIncomplete;
}

export default function CaseWorkflowStepper({ report, workOrders }: CaseWorkflowStepperProps) {
  const steps = getCaseWorkflowSteps(report, workOrders);
  const currentIndex = getCurrentStepIndex(steps);
  const completedCount = steps.filter((step) => step.done).length;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 px-3 py-4" aria-label={`案件處理流程進度，已完成 ${completedCount} / ${steps.length} 步`}>
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex && !step.done;
          const state = step.done ? 'done' : isCurrent ? 'current' : 'upcoming';
          return (
            <li key={step.key} className="relative flex flex-1 flex-col items-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-4 h-0.5 w-full ${steps[index - 1].done ? 'bg-[#006b2c]' : 'bg-zinc-200'}`}
                />
              )}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black ${
                  state === 'done'
                    ? 'border-[#006b2c] bg-[#006b2c] text-white'
                    : state === 'current'
                      ? 'border-[#006b2c] bg-white text-[#006b2c] ring-2 ring-[#006b2c]/20'
                      : 'border-zinc-200 bg-white text-zinc-400'
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={`mt-1.5 text-center text-[10px] font-bold leading-tight ${
                  state === 'upcoming' ? 'text-zinc-400' : 'text-zinc-700'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
