// EMI schedule generation per PRD §5.3

export interface EmiScheduleEntry {
  seq: number;
  dueDate: Date;
  amountPaise: number;
}

/**
 * Returns the first occurrence of `emiDay` that is at least 20 days after `disbursalDate`.
 */
export function computeFirstEmiDate(disbursalDate: Date, emiDay: number): Date {
  const minDate = new Date(disbursalDate);
  minDate.setDate(minDate.getDate() + 20);

  // Try current month
  const candidate = new Date(disbursalDate.getFullYear(), disbursalDate.getMonth(), emiDay);
  if (candidate >= minDate) return candidate;

  // Try next month
  const nextMonth = new Date(disbursalDate.getFullYear(), disbursalDate.getMonth() + 1, emiDay);
  if (nextMonth >= minDate) return nextMonth;

  // Try month after
  return new Date(disbursalDate.getFullYear(), disbursalDate.getMonth() + 2, emiDay);
}

/**
 * Generate the full EMI schedule.
 * EMI = principal / tenure (equal principal instalments).
 * Rounding: last EMI absorbs any rounding difference.
 */
export function generateEmiSchedule(
  principalPaise: number,
  tenureMonths: number,
  firstEmiDate: Date,
): EmiScheduleEntry[] {
  const baseEmi = Math.floor(principalPaise / tenureMonths);
  const schedule: EmiScheduleEntry[] = [];

  let totalAllocated = 0;

  for (let i = 0; i < tenureMonths; i++) {
    const dueDate = new Date(firstEmiDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const isLast = i === tenureMonths - 1;
    const amount = isLast ? principalPaise - totalAllocated : baseEmi;
    totalAllocated += amount;

    schedule.push({ seq: i + 1, dueDate, amountPaise: amount });
  }

  return schedule;
}

/**
 * Flat-rate interest calculation per PRD §5.3.
 */
export function computeLoanTerms(
  principalPaise: number,
  interestRateBps: number,  // basis points per month, 100 bps = 1%
  tenureMonths: number,
) {
  const monthlyRate = interestRateBps / 10000; // convert bps to decimal
  const interestPaise = Math.round(principalPaise * monthlyRate * tenureMonths);
  const disbursalPaise = principalPaise - interestPaise;
  const emiPaise = Math.floor(principalPaise / tenureMonths);

  return { interestPaise, disbursalPaise, emiPaise };
}
