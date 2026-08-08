import {
  settlementInputSchema,
  type SettlementInput,
  type SettlementStatus,
} from '@/modules/order-status/domain/schemas';

export interface SettlementResult {
  readonly status: SettlementStatus;
  readonly amountDueMinor: number;
  readonly isOverdue: boolean;
}

export function evaluateSettlement(input: SettlementInput): SettlementResult {
  const validated = settlementInputSchema.parse(input);
  const amountDueMinor = validated.totalMinor - validated.amountPaidMinor;

  const status: SettlementStatus = deriveStatus(
    validated.amountPaidMinor,
    validated.totalMinor,
    validated.asOfUtcDate,
    validated.dueDate,
  );

  return {
    status,
    amountDueMinor,
    isOverdue: status === 'overdue',
  };
}

function deriveStatus(
  amountPaidMinor: number,
  totalMinor: number,
  asOfUtcDate: string,
  dueDate: string,
): SettlementStatus {
  if (amountPaidMinor === totalMinor) {
    return 'paid';
  }

  if (asOfUtcDate > dueDate) {
    return 'overdue';
  }

  if (amountPaidMinor > 0) {
    return 'partially_paid';
  }

  return 'pending';
}
