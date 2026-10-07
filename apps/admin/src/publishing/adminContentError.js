export class AdminContentRequestError extends Error {
  constructor(response, payload, fallback) {
    super(payload?.error?.message ?? fallback);
    this.name = 'AdminContentRequestError';
    this.status = response.status;
    this.code = payload?.error?.code;
  }
}

export const isPreviewContentDisabled = (error) => error?.status === 503
  && error?.code === 'admin/preview-backend-disabled';
