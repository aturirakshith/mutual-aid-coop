// All money stored in paise (1 rupee = 100 paise)

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

// Indian number format: ₹1,00,000
export function formatInr(paise: number, showNegativePrefix = true): string {
  const rupees = Math.abs(paise / 100);
  const isNegative = paise < 0;

  const formatted = rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (isNegative && showNegativePrefix) {
    return `−₹${formatted}`;
  }
  return `₹${formatted}`;
}

export function formatInrSigned(paise: number): string {
  if (paise >= 0) return `+${formatInr(paise)}`;
  return formatInr(paise);
}
