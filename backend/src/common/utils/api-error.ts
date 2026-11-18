export type ApiIssue = { path: string; message: string };

class ApiError extends Error {
  statusCode: number;
  issues?: ApiIssue[];

  constructor(statusCode: number, message: string, issues?: ApiIssue[]) {
    super(message);
    this.statusCode = statusCode;
    this.issues = issues;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", issues?: ApiIssue[]) {
    return new ApiError(400, message, issues);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notfound(message = "Not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static unavailable(message = "Service unavailable") {
    return new ApiError(503, message);
  }
}

export default ApiError;
