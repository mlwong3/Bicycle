import type { AdminReport, AiCaseClassification, AiClassificationInput, ManualRubric } from './types';

const RUBRIC_KEYS: (keyof ManualRubric)[] = ['rust', 'tire', 'dust', 'attachment', 'missing', 'lock'];

export function buildAiClassificationInput(report: AdminReport): AiClassificationInput {
  const rubric = report.manualRubric;
  return {
    reportId: report.id,
    description: report.description,
    citizenTags: report.citizenTags || [],
    locationLabel: report.location,
    hasCoordinates: report.coordinatesValid && Number.isFinite(report.lat) && Number.isFinite(report.lng),
    manualRubricSummary: rubric
      ? {
        observedIndicators: RUBRIC_KEYS.filter((key) => rubric[key].observable),
        unobservableIndicators: RUBRIC_KEYS.filter((key) => !rubric[key].observable),
      }
      : undefined,
  };
}

function contains(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function fallbackClassifyReport(input: AiClassificationInput): AiCaseClassification {
  const text = `${input.description} ${input.citizenTags.join(' ')}`;
  const missingInformation: string[] = [];
  if (!input.hasCoordinates) missingInformation.push('GPS 位置');
  if (input.description.trim().length < 8) missingInformation.push('更完整的案件描述');

  let caseType: AiCaseClassification['caseType'] = 'other';
  let obstructionLevel: AiCaseClassification['obstructionLevel'] = 0;
  let suggestedDepartment: string | null = null;
  let rationale = ['資料未足以套用特定分類，建議由管理員覆核。'];

  if (contains(text, ['阻塞', '行人', '通道', 'obstruction'])) {
    caseType = 'obstruction';
    obstructionLevel = 3;
    suggestedDepartment = '示範跨部門聯合小組';
    rationale = ['描述或標籤包含通道阻塞訊號。'];
  } else if (contains(text, ['安全', '危險', 'safety'])) {
    caseType = 'safety_hazard';
    obstructionLevel = 2;
    suggestedDepartment = '示範現場安全小組';
    rationale = ['描述或標籤包含安全風險訊號。'];
  } else if (contains(text, ['棄置', '無人', '草叢', 'abandoned'])) {
    caseType = 'suspected_abandoned';
    suggestedDepartment = '示範單車管理小組';
    rationale = ['描述或標籤提及疑似棄置情況；不代表已確認棄置。'];
  } else if (contains(text, ['破損', '損壞', '斷裂', 'damaged'])) {
    caseType = 'damaged_bicycle';
    suggestedDepartment = '示範單車管理小組';
    rationale = ['描述或標籤包含單車破損訊號。'];
  } else if (contains(text, ['違泊', '違規停泊', 'illegal'])) {
    caseType = 'illegal_parking';
    suggestedDepartment = '示範泊位管理小組';
    rationale = ['描述或標籤包含違規停泊訊號。'];
  }

  const confidence: AiCaseClassification['confidence'] = missingInformation.length > 0
    ? 'low'
    : input.manualRubricSummary && input.manualRubricSummary.observedIndicators.length >= 3
      ? 'high'
      : 'medium';
  const urgency: AiCaseClassification['urgency'] = caseType === 'safety_hazard' || obstructionLevel === 3 ? 'urgent' : 'normal';
  const priorityBand: AiCaseClassification['priorityBand'] = urgency === 'urgent' ? 'high' : confidence === 'low' ? 'medium' : 'low';
  const suggestedAction: AiCaseClassification['suggestedAction'] = missingInformation.length > 0
    ? '建議補充資料'
    : confidence === 'low'
      ? '建議現場覆核'
      : suggestedDepartment
        ? '建議交由負責部門再確認'
        : '建議一般程序處理';

  return {
    caseType,
    urgency,
    obstructionLevel,
    suggestedDepartment,
    missingInformation,
    possibleDuplicateReportIds: [],
    priorityBand,
    rationale,
    confidence,
    source: 'rule-fallback',
    suggestedAction,
  };
}

export async function classifyReportText(input: AiClassificationInput): Promise<AiCaseClassification> {
  return fallbackClassifyReport(input);
}
