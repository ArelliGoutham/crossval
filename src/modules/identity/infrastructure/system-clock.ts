import type { Clock } from '@/modules/identity/domain/ports';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
