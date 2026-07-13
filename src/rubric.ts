import type { ManualRubric, RubricObservation, RubricSummary } from './types';

const RUBRIC_KEYS: (keyof ManualRubric)[] = ['rust', 'tire', 'dust', 'attachment', 'missing', 'lock'];

export function calculateRubricSummary(rubric: ManualRubric): RubricSummary {
  const observations = RUBRIC_KEYS
    .map((key) => rubric[key])
    .filter((observation): observation is RubricObservation => observation.observable && observation.score !== null);
  const totalScore = observations.reduce((sum, observation) => sum + (observation.score || 0), 0);
  const scoredCount = observations.length;

  return {
    observableCount: RUBRIC_KEYS.filter((key) => rubric[key].observable).length,
    scoredCount,
    totalScore: scoredCount > 0 ? totalScore : null,
    maximumObservableScore: scoredCount * 3,
    dataSufficiency: scoredCount === RUBRIC_KEYS.length ? 'sufficient' : scoredCount > 0 ? 'partial' : 'insufficient',
  };
}
