import { PipeTransform } from '@nestjs/common';
import { ZodError } from 'zod';

import { throwValidationError } from './contract-errors';

type ParseableSchema<T> = {
  parse(value: unknown): T;
};

export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ParseableSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message
        }));
        throwValidationError(details);
      }
      throw err;
    }
  }
}
