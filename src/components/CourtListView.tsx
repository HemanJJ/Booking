"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn, formatPrice, formatDate, weekdayOf, formatHours } from "@/lib/utils";

export type CourtListItem = {
  id: string;
  name: string;
  venueName: string;
  location: string | null;
  pricePerHour: number;
  priceMin: number;
  priceMax: number;
  openingTime: string;
  closingTime: string;
  thumbnail: string | null;
  facilities: string[];
  nextSlot: { date: string; startTime: string } | null;
};

function NextSlot({ slot }: { slot: { date: string; startTime: string } | null }) {
  if (!slot) {
    return <span className="text-slate-400">暫無可預約時段</span>;
  }
  return (
    <span className="text-slate-600">
      <span className="font-medium text-emerald-700">
        {formatDate(slot.date)} ({weekdayOf(slot.date)}) {slot.startTime}
      </span>{" "}
      起可預約
    </span>
  );
}

export default function CourtListView({
  courts,
}: {
  courts: CourtListItem[];
}) {
  const [view, setView] = useState<"card" | "list">("card");

  return (
    <div>
      <div className="mb-6 flex items-center justify-end gap-2">
        <button
          onClick={() => setView("card")}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium",
            view === "card"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 text-slate-600 hover:bg-slate-100"
          )}
        >
          卡片
        </button>
        <button
          onClick={() => setView("list")}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium",
            view === "list"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 text-slate-600 hover:bg-slate-100"
          )}
        >
          列表
        </button>
      </div>

      {view === "card" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <Link
              key={court.id}
              href={`/courts/${court.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
                {court.thumbnail ? (
                  <Image
                    src={court.thumbnail}
                    alt={`${court.venueName} ${court.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-slate-400">
                    無圖片
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold text-slate-900">
                  {court.venueName} · {court.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  📍 {court.location ?? court.venueName}
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <p>
                    <span className="font-semibold text-emerald-700">
                      {formatPrice(court.priceMin)}
                      {court.priceMax > court.priceMin &&
                        ` ~ ${formatPrice(court.priceMax)}`}
                    </span>
                    <span className="text-slate-500"> / 小時</span>
                  </p>
                  <p>
                    <NextSlot slot={court.nextSlot} />
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700 group-hover:underline">
                    查看詳情
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatHours(court.openingTime, court.closingTime)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {courts.map((court, i) => (
            <div
              key={court.id}
              className={cn(
                "flex items-center gap-4 p-4",
                i !== courts.length - 1 && "border-b border-slate-100"
              )}
            >
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                {court.thumbnail && (
                  <Image
                    src={court.thumbnail}
                    alt={`${court.venueName} ${court.name}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/courts/${court.id}`}
                  className="font-semibold text-slate-900 hover:text-emerald-700"
                >
                  {court.venueName} · {court.name}
                </Link>
                <p className="truncate text-sm text-slate-500">
                  {court.location ?? court.venueName} ·{" "}
                  {formatPrice(court.priceMin)}
                  {court.priceMax > court.priceMin &&
                    ` ~ ${formatPrice(court.priceMax)}`}{" "}
                  / 小時
                </p>
              </div>
              <div className="hidden shrink-0 text-sm sm:block">
                <NextSlot slot={court.nextSlot} />
              </div>
              <Link
                href={`/courts/${court.id}`}
                className="shrink-0 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                查看詳情
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
