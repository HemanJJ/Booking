// 純函數（無 Prisma，可供 client 端匯入做金額試算）

export type DurationDiscountLike = {
  minMinutes: number;
  fixedAmount: number;
  tierPrice: number | null; // 僅限此「每小時價」的時段；null＝所有時段
};

/**
 * 把時長折扣套用到一筆訂位（多個 30 分時段）。
 * - 先算時段總價
 * - 對每條折扣：符合門檻時長（且 tierPrice 相符）就折抵固定金額
 * 回傳 { baseTotal, discountTotal, total }。
 */
export function applyDurationDiscounts(
  perSlot: { startTime: string; hourlyPrice: number }[],
  discounts: DurationDiscountLike[]
): { baseTotal: number; discountTotal: number; total: number } {
  const baseTotal = perSlot.reduce(
    (sum, s) => sum + Math.round((s.hourlyPrice * 30) / 60),
    0
  );

  let discountTotal = 0;
  for (const d of discounts) {
    const applicable =
      d.tierPrice == null
        ? perSlot
        : perSlot.filter((s) => s.hourlyPrice === d.tierPrice);
    if (applicable.length * 30 >= d.minMinutes) {
      discountTotal += d.fixedAmount;
    }
  }

  return {
    baseTotal,
    discountTotal,
    total: Math.max(0, baseTotal - discountTotal),
  };
}
