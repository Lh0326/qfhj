const DEFAULT_TEMPERATURE = 15;

function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

export function softmaxWithTemperature(logits, temperature = DEFAULT_TEMPERATURE) {
  const safeTemperature = Math.max(1e-6, temperature);
  if (!Array.isArray(logits) || logits.length === 0) return [];

  const scaled = logits.map((logit) => (Number.isFinite(logit) ? logit : 0) / safeTemperature);
  const maxLogit = Math.max(...scaled);
  const exps = scaled.map((logit) => Math.exp(logit - maxLogit));
  const sum = exps.reduce((acc, value) => acc + value, 0);

  if (!Number.isFinite(sum) || sum <= 0) {
    return logits.map(() => 1 / logits.length);
  }
  return exps.map((value) => value / sum);
}

function calculateResponseQuality(answerValues) {
  if (!answerValues.length) return 0;

  const uniqueCount = new Set(answerValues).size;
  const extremeRatio = answerValues.filter((v) => v === 1 || v === 5).length / answerValues.length;

  const counts = new Map();
  for (const value of answerValues) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const maxSameAnswerRatio = Math.max(...counts.values()) / answerValues.length;

  const straightLinePenalty = uniqueCount <= 1 ? 0.35 : uniqueCount === 2 ? 0.75 : 1;
  const extremePenalty = extremeRatio > 0.9 ? 0.75 : extremeRatio > 0.75 ? 0.9 : 1;
  const dominancePenalty = maxSameAnswerRatio > 0.9 ? 0.55 : maxSameAnswerRatio > 0.8 ? 0.75 : 1;

  return clamp(straightLinePenalty * extremePenalty * dominancePenalty);
}

function calculateDecisionEvidence(result, allResults) {
  const score = Number(result?.transformedScore) || 0;
  const typeId = result?.type?.id;

  if (typeId !== 'neutral') {
    // 偏颇体质的标准阈值为 30（倾向是）/40（是）。
    // 以 30 作为进入候选类别的决策边界，40 以上自然获得更强证据。
    return score - 30;
  }

  const biasedScores = allResults
    .filter((item) => item?.type?.id !== 'neutral')
    .map((item) => Number(item?.transformedScore) || 0);
  const highestBiased = biasedScores.length ? Math.max(...biasedScores) : 0;

  // 平和质需要“平和分高”且“偏颇分低”两个条件同时成立，取较弱证据更保守。
  const neutralEvidence = score - 60;
  const biasedSuppressionEvidence = 30 - highestBiased;
  return Math.min(neutralEvidence, biasedSuppressionEvidence);
}

function calculateThresholdStability(primary, allResults) {
  const score = Number(primary?.transformedScore) || 0;
  if (primary?.type?.id === 'neutral') {
    const highestBiased = Math.max(
      0,
      ...allResults
        .filter((item) => item?.type?.id !== 'neutral')
        .map((item) => Number(item?.transformedScore) || 0)
    );
    const neutralDistance = score - 60;
    const biasedDistance = 30 - highestBiased;
    return sigmoid(Math.min(neutralDistance, biasedDistance) / 8);
  }

  const boundary = score >= 40 ? 40 : 30;
  const thresholdStability = sigmoid((score - boundary) / 8);
  const competingScores = allResults
    .filter((item) => item?.type?.id !== primary?.type?.id)
    .map((item) => Number(item?.transformedScore) || 0);
  const runnerUp = competingScores.length ? Math.max(...competingScores) : 0;
  const gapStability = sigmoid((score - runnerUp) / 8);

  return Math.min(thresholdStability, gapStability);
}

function calculateEntropyCertainty(probabilities) {
  if (!probabilities.length || probabilities.length === 1) return 1;
  const entropy = -probabilities.reduce((sum, probability) => {
    if (probability <= 0) return sum;
    return sum + probability * Math.log(probability);
  }, 0);
  return clamp(1 - entropy / Math.log(probabilities.length));
}

export function calculateCalibratedConstitutionConfidence(
  results,
  primary,
  answeredCount,
  totalQuestions,
  answers,
  options = {}
) {
  const safeResults = Array.isArray(results) ? results : [];
  const completion = totalQuestions > 0 ? clamp(answeredCount / totalQuestions) : 0;
  const answerValues = Object.values(answers || {}).filter((value) => Number.isFinite(value));
  const responseQuality = calculateResponseQuality(answerValues);

  if (!safeResults.length || !primary) {
    return {
      score: 0,
      level: '低',
      method: 'temperature-scaled-softmax',
      breakdown: {
        completion: Math.round(completion * 100),
        calibratedProbability: 0,
        entropyCertainty: 0,
        decisionMargin: 0,
        responseQuality: Math.round(responseQuality * 100),
      },
    };
  }

  const temperature = options.temperature || DEFAULT_TEMPERATURE;
  const logits = safeResults.map((item) => calculateDecisionEvidence(item, safeResults));
  const probabilities = softmaxWithTemperature(logits, temperature);
  const primaryIndex = safeResults.findIndex((item) => item?.type?.id === primary?.type?.id);
  const calibratedProbability = probabilities[Math.max(0, primaryIndex)] || Math.max(...probabilities, 0);
  const entropyCertainty = calculateEntropyCertainty(probabilities);
  const decisionMargin = calculateThresholdStability(primary, safeResults);

  // 迁移 Guo et al. ICML 2017 的温度缩放校准思想：
  // 1) 将各体质“距判定阈值的证据”视作 logits；
  // 2) 用温度缩放 softmax 得到更保守的类别概率；
  // 3) 再用熵、阈值稳定性、完成率和答题质量修正，避免把量表分数伪装成医学准确率。
  const calibratedCore =
    0.65 * calibratedProbability +
    0.25 * entropyCertainty +
    0.10 * decisionMargin;
  const composite = calibratedCore * completion * responseQuality;
  const score = Math.round(clamp(composite) * 100);

  let level;
  if (score >= 80) level = '高';
  else if (score >= 60) level = '中';
  else if (score >= 40) level = '较低';
  else level = '低';

  return {
    score,
    level,
    method: 'temperature-scaled-softmax',
    breakdown: {
      completion: Math.round(completion * 100),
      calibratedProbability: Math.round(calibratedProbability * 100),
      entropyCertainty: Math.round(entropyCertainty * 100),
      decisionMargin: Math.round(decisionMargin * 100),
      responseQuality: Math.round(responseQuality * 100),
    },
  };
}
