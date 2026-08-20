"use client";

import { useEffect, useState } from "react";
import type { DurationDiscountLike } from "@/lib/pricing-core";

export type CourtSlot = {
  startTime: string;
  available: boolean;
  hourlyPrice: number;
};

export type CourtInfo = {
  id: string;
  name: string;
  venueName: string;
  pricePerHour: number;
  openingTime: string;
  closingTime: string;
};

/** 拉取某場地某日時段＋折扣（供代客下單 / 改單表單共用）
 *  @param excludeBookingId 改單時傳入，忽略該筆訂位自己佔用的時段
 */
export function useCourtSlots(
  courtId: string,
  date: string,
  excludeBookingId?: string
) {
  const [slots, setSlots] = useState<CourtSlot[]>([]);
  const [discounts, setDiscounts] = useState<DurationDiscountLike[]>([]);
  const [court, setCourt] = useState<CourtInfo | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courtId || !date) return;
    let cancelled = false;
    setError(null);
    const qs = `courtId=${courtId}&date=${date}${
      excludeBookingId ? `&excludeBookingId=${excludeBookingId}` : ""
    }`;
    fetch(`/api/bookings/available?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error as string);
          setSlots([]);
          setDiscounts([]);
          setCourt(null);
        } else {
          setSlots((d.slots as CourtSlot[]) ?? []);
          setDiscounts((d.discounts as DurationDiscountLike[]) ?? []);
          setCourt((d.court as CourtInfo) ?? null);
        }
        setLoadedKey(`${courtId}:${date}:${excludeBookingId ?? ""}`);
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setDiscounts([]);
          setLoadedKey(`${courtId}:${date}:${excludeBookingId ?? ""}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [courtId, date, excludeBookingId]);

  const key = `${courtId}:${date}:${excludeBookingId ?? ""}`;
  const loading = loadedKey !== key;
  return { slots, discounts, court, loading, error };
}
