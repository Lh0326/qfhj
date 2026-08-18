import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCalibratedConstitutionConfidence,
  softmaxWithTemperature,
} from './tcmConstitutionConfidence.js';

const types = {
  neutral: { id: 'neutral', name: '平和质' },
  qi: { id: 'qi_deficiency', name: '气虚质' },
  yang: { id: 'yang_deficiency', name: '阳虚质' },
  damp: { id: 'damp_heat', name: '湿热质' },
};

function result(type, score, judgment = '否') {
  return { type, transformedScore: score, judgment, rawScore: 0, itemCount: 8 };
}

function answers(count, valueFactory) {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, valueFactory(i)]));
}

test('temperature-scaled softmax returns normalized calibrated probabilities', () => {
  const probabilities = softmaxWithTemperature([80, 50, 20], 15);

  assert.equal(probabilities.length, 3);
  assert.ok(Math.abs(probabilities.reduce((sum, p) => sum + p, 0) - 1) < 1e-12);
  assert.ok(probabilities[0] > probabilities[1]);
  assert.ok(probabilities[1] > probabilities[2]);
  assert.ok(probabilities[0] < 1, 'temperature scaling must avoid fake 100% certainty');
});

test('clear dominant constitution receives high but not absolute confidence', () => {
  const results = [
    result(types.qi, 82, '是'),
    result(types.yang, 34, '倾向是'),
    result(types.damp, 18, '否'),
    result(types.neutral, 28, '否'),
  ];

  const confidence = calculateCalibratedConstitutionConfidence(
    results,
    results[0],
    66,
    66,
    answers(66, (i) => (i % 5) + 1)
  );

  assert.ok(confidence.score >= 80, `expected high confidence, got ${confidence.score}`);
  assert.ok(confidence.score < 98, 'medical questionnaire confidence should not become absolute');
  assert.ok(confidence.breakdown.calibratedProbability > 80);
  assert.equal(confidence.method, 'temperature-scaled-softmax');
});

test('close competing constitutions are downgraded by calibrated probability and entropy', () => {
  const results = [
    result(types.qi, 45, '是'),
    result(types.yang, 43, '是'),
    result(types.damp, 39, '倾向是'),
    result(types.neutral, 36, '否'),
  ];

  const confidence = calculateCalibratedConstitutionConfidence(
    results,
    results[0],
    66,
    66,
    answers(66, (i) => (i % 4) + 1)
  );

  assert.ok(confidence.score < 70, `ties near the threshold should be at most medium confidence, got ${confidence.score}`);
  assert.ok(confidence.breakdown.entropyCertainty < 45);
  assert.ok(confidence.breakdown.decisionMargin < 60);
});

test('straight-line answers are penalized even when a score is high', () => {
  const results = [
    result(types.qi, 92, '是'),
    result(types.yang, 18, '否'),
    result(types.damp, 12, '否'),
    result(types.neutral, 20, '否'),
  ];

  const confidence = calculateCalibratedConstitutionConfidence(
    results,
    results[0],
    66,
    66,
    answers(66, () => 5)
  );

  assert.ok(confidence.score < 65, `straight-line response should materially reduce confidence, got ${confidence.score}`);
  assert.ok(confidence.breakdown.responseQuality <= 40);
});
