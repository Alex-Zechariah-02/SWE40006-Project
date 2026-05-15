import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { ZodError } from 'zod';

import { throwValidationError } from './contract-errors';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown) {
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

