export const MODEL_POLICIES = {
  fast: {
    label: 'Fast',
    description: 'Prioritize low latency for everyday questions.',
  },
  balanced: {
    label: 'Balanced',
    description: 'Default mode for quality and speed.',
  },
  deep: {
    label: 'Deep',
    description: 'Use the strongest available model for harder work.',
  },
  private: {
    label: 'Local / Private',
    description: 'Prefer locally hosted models for sensitive work.',
  },
};

export const MODEL_POLICY_ORDER = ['fast', 'balanced', 'deep', 'private'];

export const normalizePolicy = (policy) => (
  MODEL_POLICY_ORDER.includes(policy) ? policy : 'balanced'
);

const scoreModelForPolicy = (model, policy, index) => {
  const name = model.toLowerCase();
  let score = 1000 - index;

  if (policy === 'fast') {
    if (/(mini|small|lite|flash|fast|8b|7b)/.test(name)) score += 100;
    if (/(70b|72b|405b|large|reason|r1|deep)/.test(name)) score -= 50;
  }

  if (policy === 'balanced') {
    if (/(qwen|deepseek|gpt|claude|mistral|llama)/.test(name)) score += 25;
    if (/(mini|small|8b|7b)/.test(name)) score += 10;
  }

  if (policy === 'deep') {
    if (/(reason|r1|deep|70b|72b|405b|large|opus|sonnet|gpt-5|o3)/.test(name)) score += 120;
    if (/(mini|small|lite|flash)/.test(name)) score -= 40;
  }

  if (policy === 'private') {
    if (/(localhost|local|ollama|lm studio|deepseek|qwen|llama|mistral|bge)/.test(name)) score += 120;
    if (/(gpt|claude|gemini|openai|anthropic)/.test(name)) score -= 80;
  }

  return score;
};

export const chooseModelForPolicy = (models, policy, manualModel) => {
  if (!Array.isArray(models) || models.length === 0) return null;
  if (manualModel && models.includes(manualModel)) return manualModel;

  return [...models].sort((left, right) => {
    const leftIndex = models.indexOf(left);
    const rightIndex = models.indexOf(right);
    return scoreModelForPolicy(right, policy, rightIndex) - scoreModelForPolicy(left, policy, leftIndex);
  })[0];
};
