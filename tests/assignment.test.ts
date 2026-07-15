import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendTeams } from '../src/assignment';
import type { Team, WorkOrder } from '../src/types';

const order: WorkOrder = {
  id: 'wo-removal', caseId: 'case-1', taskType: 'removal', title: '移走單車',
  leadDepartment: 'FEHD', supportingDepartments: [], location: '沙田源禾路體育館外', district: '沙田', priority: 'urgent',
  dueAt: '2026-07-16T09:00:00.000Z', prerequisiteWorkOrderIds: [],
  requiredCapabilities: ['bicycle-removal'], requiredEquipment: ['removal-vehicle'],
  evidenceChecklist: [], status: 'draft', assignmentHistory: [],
  createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
};

const teams: Team[] = [
  { id: 'wrong-dept', name: '地政隊', department: 'LandsD', districts: ['沙田'], capabilities: ['bicycle-removal'], equipment: ['removal-vehicle'], onDuty: true, dailyCapacity: 5, activeWorkload: 0 },
  { id: 'fehd-b', name: '食環 B 隊', department: 'FEHD', districts: ['沙田'], capabilities: ['bicycle-removal'], equipment: ['removal-vehicle'], onDuty: true, dailyCapacity: 5, activeWorkload: 4 },
  { id: 'fehd-a', name: '食環 A 隊', department: 'FEHD', districts: ['沙田'], capabilities: ['bicycle-removal'], equipment: ['removal-vehicle'], onDuty: true, dailyCapacity: 5, activeWorkload: 1 },
];

test('legal department and capabilities are hard filters', () => {
  const result = recommendTeams(order, teams, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(result.map((item) => item.teamId), ['fehd-a', 'fehd-b']);
  assert.equal(result.some((item) => item.teamId === 'wrong-dept'), false);
});

test('same inputs produce the same recommendation and explanation', () => {
  const first = recommendTeams(order, teams, new Date('2026-07-15T09:00:00.000Z'));
  const second = recommendTeams(order, teams, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(first, second);
  assert.equal(first[0].reasons.includes('部門權責符合'), true);
});
