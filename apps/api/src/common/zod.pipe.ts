import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from './errors.js';

/** Validates a request body with a Zod schema: `@Body(new ZodPipe(schema)) body`. */
@Injectable()
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}
  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    throw new AppError(400, 'invalid_input', r.error.issues[0]?.message ?? 'Check what you entered.', {
      fields: r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
}
