/**
 * Formats a numeric value into Indian Currency representation (e.g. ₹1,25,000)
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return amount < 0 ? `-₹${formatted}` : `₹${formatted}`;
}
