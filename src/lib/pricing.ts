import { prisma } from "./prisma";
import {
  applyDurationDiscounts,
  type DurationDiscountLike,
} from "./pricing-core";

export type PriceRuleLike = {
  name: string;
  kind: string;
  price: number;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  date: string | null;
};

/** "YYYY-MM-DD" → 星期（0=日 1=一 … 6=六，與 JS getDay 一致） */
export function weekdayOfDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * 解析單一時段（30 分鐘）的「每小時價」：
 * 1) 特定日期（國定假日/颱風假）優先，整日生效
 * 2) 固定週規則（週幾＋時段）
 * 3) 無規則時回退到 fallback（場地的 pricePerHour）
 */
export function resolveSlotPrice(
  rules: PriceRuleLike[],
  date: string,
  startTime: string,
  fallback: number
): number {
  const dow = weekdayOfDate(date);

  const dateRule = rules.find((r) => r.kind === "date" && r.date === date);
  if (dateRule) return dateRule.price;

  const weekly = rules.find(
    (r) =>
      r.kind === "weekly" &&
      r.dayOfWeek === dow &&
      r.startTime !== null &&
      r.endTime !== null &&
      startTime >= r.startTime &&
      startTime < r.endTime
  );
  if (weekly) return weekly.price;

  return fallback;
}

export async function getActiveRules(venueId: string): Promise<PriceRuleLike[]> {
  return prisma.priceRule.findMany({
    where: { venueId, active: "active" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      name: true,
      kind: true,
      price: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      date: true,
    },
  });
}

export async function getActiveDiscounts(
  venueId: string
): Promise<DurationDiscountLike[]> {
  return prisma.durationDiscount.findMany({
    where: { venueId, active: "active" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { minMinutes: true, fixedAmount: true, tierPrice: true },
  });
}

/** 計算一筆訂位（多個 30 分時段）的總價、原價、折扣與各時段價 */
export async function computeBookingTotal(
  venueId: string,
  date: string,
  slotStarts: string[],
  fallback: number
): Promise<{
  total: number;
  baseTotal: number;
  discountTotal: number;
  perSlot: { startTime: string; hourlyPrice: number }[];
}> {
  const [rules, discounts] = await Promise.all([
    getActiveRules(venueId),
    getActiveDiscounts(venueId),
  ]);
  const perSlot = slotStarts.map((startTime) => ({
    startTime,
    hourlyPrice: resolveSlotPrice(rules, date, startTime, fallback),
  }));
  const { baseTotal, discountTotal, total } = applyDurationDiscounts(
    perSlot,
    discounts
  );
  return { total, baseTotal, discountTotal, perSlot };
}

/** 價格區間（供列表/詳情顯示「NT$300 ~ 400」） */
export async function getPriceRange(
  venueId: string,
  fallback: number
): Promise<{ min: number; max: number; tiers: { name: string; price: number }[] }> {
  const rules = await getActiveRules(venueId);
  if (rules.length === 0) {
    return { min: fallback, max: fallback, tiers: [] };
  }
  const prices = rules.map((r) => r.price);
  const tiers: { name: string; price: number }[] = [];
  const seen = new Set<number>();
  for (const r of rules) {
    if (!seen.has(r.price)) {
      seen.add(r.price);
      tiers.push({ name: r.name, price: r.price });
    }
  }
  tiers.sort((a, b) => a.price - b.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    tiers,
  };
}
