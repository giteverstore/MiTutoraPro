export class AIProvider {
  async explain() {
    throw new Error('AIProvider.explain() must be implemented by a provider.');
  }

  getMetadata() {
    return { provider: 'unknown', model: 'unknown' };
  }
}
