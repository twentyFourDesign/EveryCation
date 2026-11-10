import { HttpException } from '@nestjs/common';

/** An error the apps can act on: a stable `code` plus a message written for the person using the app. */
export class AppError extends HttpException {
  constructor(status: number, readonly code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ code, message, ...extra }, status);
  }
}
export const badRequest = (code: string, message: string, extra?: Record<string, unknown>) => new AppError(400, code, message, extra);
export const unauthorized = (code = 'unauthorized', message = 'Please sign in again.') => new AppError(401, code, message);
export const forbidden = (code: string, message: string) => new AppError(403, code, message);
export const notFound = (what: string) => new AppError(404, 'not_found', `${what} was not found.`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const tooMany = (code: string, message: string, extra?: Record<string, unknown>) => new AppError(429, code, message, extra);
