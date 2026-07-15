import type { Team, WorkOrder } from './types';

export interface TeamRecommendation {
  teamId: string;
  score: number;
  reasons: string[];
}

function includesAll(actual: string[], required: string[]): boolean {
  return required.every((item) => actual.includes(item));
}

export function recommendTeams(order: WorkOrder, teams: Team[], now: Date): TeamRecommendation[] {
  return teams
    .filter((team) => team.department === order.leadDepartment)
    .filter((team) => team.onDuty && team.districts.includes(order.district))
    .filter((team) => includesAll(team.capabilities, order.requiredCapabilities))
    .filter((team) => includesAll(team.equipment, order.requiredEquipment))
    .map((team) => {
      const urgency = order.priority === 'emergency' ? 100 : order.priority === 'urgent' ? 75 : 50;
      const daysUntilDue = order.dueAt ? Math.max(0, (Date.parse(order.dueAt) - now.getTime()) / 86400000) : 5;
      const due = Math.max(0, 100 - daysUntilDue * 10);
      const district = 100;
      const capability = 100;
      const workload = Math.max(0, 100 * (1 - team.activeWorkload / Math.max(1, team.dailyCapacity)));
      const score = order.priority === 'emergency'
        ? 1000 + workload
        : 0.35 * urgency + 0.25 * due + 0.15 * district + 0.15 * capability + 0.10 * workload;
      return {
        teamId: team.id,
        score: Math.round(score * 100) / 100,
        reasons: ['部門權責符合', '服務地區符合', '職能及設備符合', `現時工作量 ${team.activeWorkload}/${team.dailyCapacity}`],
      };
    })
    .sort((a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId));
}
