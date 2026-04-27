export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'USER_NOT_FOUND'
  | 'DUPLICATE_EMAIL';

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new AppError('BAD_REQUEST', message, 400, details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError('UNAUTHORIZED', message, 401);
  }
  static forbidden(message = 'Forbidden') {
    return new AppError('FORBIDDEN', message, 403);
  }
  static notFound(message = 'Not found') {
    return new AppError('NOT_FOUND', message, 404);
  }
  static conflict(message = 'Conflict', details?: unknown) {
    return new AppError('CONFLICT', message, 409, details);
  }
  static internal(message = 'Internal server error', details?: unknown) {
    return new AppError('INTERNAL_ERROR', message, 500, details);
  }
}