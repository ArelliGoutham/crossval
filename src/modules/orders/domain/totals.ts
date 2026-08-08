export function computeLineTotal(
  quantity: number,
  unitPriceMinor: number,
): number {
  return quantity * unitPriceMinor;
}

export function computeSubtotal(lineTotals: readonly number[]): number {
  return lineTotals.reduce((sum, total) => sum + total, 0);
}
