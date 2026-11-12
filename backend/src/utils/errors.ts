export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = "INTERNAL_SERVER_ERROR",
    details: unknown = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", details: unknown = null) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details: unknown = null) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden - Access Denied", details: unknown = null) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource Not Found", details: unknown = null) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict with existing resource", details: unknown = null) {
    super(message, 409, "CONFLICT", details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation Failed", details: unknown = null) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, errorCode = "BUSINESS_RULE_VIOLATION", details: unknown = null) {
    super(message, 422, errorCode, details);
  }
}
