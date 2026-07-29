function normalizeValidatorId(validatorId) {
  return String(validatorId ?? 'normalized').trim().toLowerCase();
}

export class ValidatorRegistry {
  constructor({ defaultValidatorId = 'normalized' } = {}) {
    this.defaultValidatorId = defaultValidatorId;
    this.validators = new Map();
  }

  register(validatorId, validator) {
    const id = normalizeValidatorId(validatorId);
    if (!validator || typeof validator.validate !== 'function') {
      throw new Error(`Output validator "${id}" must implement validate().`);
    }
    this.validators.set(id, validator);
    return this;
  }

  resolve(validatorId) {
    return this.validators.get(normalizeValidatorId(validatorId))
      ?? this.validators.get(this.defaultValidatorId);
  }
}
