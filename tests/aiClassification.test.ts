import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiClassificationInput, classifyReportText } from '../src/aiClassification';

test('classification input contains text and structured fields but no image data', () => {
  const input = buildAiClassificationInput({
    id: 'r1',
    location: '示範地點',
    description: '單車阻塞行人通道',
    status: 'reviewing',
    date: '2026-07-13',
    lat: 22.38,
    lng: 114.18,
    imageUrl: 'data:image/png;base64,SECRET',
    citizenTags: ['obstruction'],
    coordinatesValid: true,
    isDuplicate: false,
    procedureConfirmed: false,
    locationSource: 'gps',
    caseType: 'other',
    urgency: 'normal',
  });
  assert.equal('imageUrl' in input, false);
  assert.equal(input.hasCoordinates, true);
  assert.deepEqual(input.citizenTags, ['obstruction']);
});

test('fallback classification is advisory and requests missing information', async () => {
  const result = await classifyReportText({
    reportId: 'r1',
    description: '單車阻塞行人通道',
    citizenTags: ['obstruction'],
    locationLabel: '示範地點',
    hasCoordinates: false,
    manualRubricSummary: { observedIndicators: [], unobservableIndicators: ['lock'] },
  });
  assert.equal(result.source, 'rule-fallback');
  assert.equal(result.caseType, 'obstruction');
  assert.equal(result.missingInformation.includes('GPS 位置'), true);
  assert.equal(result.suggestedAction, '建議補充資料');
});
