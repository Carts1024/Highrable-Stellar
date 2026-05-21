import { ConvexError } from "convex/values";

const APP_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
} as const;

type TAppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];

type TAppErrorPayload = {
  code: TAppErrorCode;
  message: string;
};

function createPayload(code: TAppErrorCode, message: string): TAppErrorPayload {
  return { code, message };
}

abstract class AppError extends ConvexError<TAppErrorPayload> {
  protected constructor(message: string, code: TAppErrorCode) {
    super(createPayload(code, message));
    this.name = new.target.name;
    this.message = message;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, APP_ERROR_CODES.BAD_REQUEST);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, APP_ERROR_CODES.NOT_FOUND);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, APP_ERROR_CODES.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, APP_ERROR_CODES.CONFLICT);
  }
}
