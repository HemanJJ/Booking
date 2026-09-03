"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { cn, nextDates } from "@/lib/utils";
import SlotPicker from "./SlotPicker";
import { adminCreateBookingAction, type AdminState } from "@/app/admin/actions";
import Spinner from "@/components/Spinner";

export type CourtOption = {
  id: string;
  name: string;
  venueName: string;
  pricePerHour: number;
};

export type MemberOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function AdminCreateBookingForm({
  courts,
  members,
}: {
  courts: CourtOption[];
  members: MemberOption[];
}) {
  const dates = useMemo(() => nextDates(14), []);
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [date, setDate] = useState(dates[0]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [memberId, setMemberId] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [walkIn, setWalkIn] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payNow, setPayNow] = useState("cash");
  const [note, setNote] = useState("");

  const [state, action, pending] = useActionState(
    adminCreateBookingAction,
    {} as AdminState
  );

  const court = courts.find((c) => c.id === courtId) ?? null;
  const q = memberQuery.trim().toLowerCase();
  const filtered = members.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q) ||
      (m.phone ?? "").includes(q)
  );

  const canSubmit =
    !!court &&
    !!startTime &&
    (!walkIn ? !!memberId : name.trim().length > 0);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="memberId" value={walkIn ? "" : memberId} />
      <input type="hidden" name="name" value={walkIn ? name : ""} />
      <input type="hidden" name="phone" value={walkIn ? phone : ""} />
      <input type="hidden" name="payNow" value={payNow} />
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="startTime" value={startTime ?? ""} />
      <input type="hidden" name="durationMinutes" value={durationMinutes} />
      <input type="hidden" name="note" value={note} />

      {/* 場地 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">場地</label>
        <select
          value={courtId}
          onChange={(e) => {
            setCourtId(e.target.value);
            setStartTime(null);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.venueName} · {c.name}
            </option>
          ))}
        </select>
      </div>

      {court && (
        <SlotPicker
          courtId={court.id}
          pricePerHour={court.pricePerHour}
          dates={dates}
          date={date}
          onDateChange={setDate}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          durationMinutes={durationMinutes}
          onDurationChange={setDurationMinutes}
        />
      )}

      {/* 客人 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">客人</label>
        {!walkIn ? (
          <div>
            <input
              type="text"
              placeholder="搜尋會員（姓名 / Email / 電話）"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
              {filtered.length === 0 && (
                <p className="p-3 text-sm text-slate-400">找不到相符會員</p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMemberId(m.id)}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                    memberId === m.id && "bg-emerald-50 text-emerald-700"
                  )}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {m.phone ?? m.email ?? ""}
                  </span>
                  {memberId === m.id && <span className="ml-2">✓</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setWalkIn(true);
                setMemberId("");
              }}
              className="mt-2 text-sm font-medium text-emerald-600 hover:underline"
            >
              ＋ 臨時客人（輸入姓名＋電話）
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <input
              type="text"
              placeholder="姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="電話（選填，方便日後查找）"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setWalkIn(false)}
              className="text-sm font-medium text-slate-500 hover:underline"
            >
              ← 改選既有會員
            </button>
          </div>
        )}
      </div>

      {/* 收款 */}
      <div>
        <label className="mb-2 block text-sm font-semibold">收款</label>
        <div className="flex gap-3">
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              payNow === "cash"
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-slate-300"
            )}
          >
            <input
              type="radio"
              checked={payNow === "cash"}
              onChange={() => setPayNow("cash")}
            />
            已收現金
          </label>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              payNow === "unpaid"
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-slate-300"
            )}
          >
            <input
              type="radio"
              checked={payNow === "unpaid"}
              onChange={() => setPayNow("unpaid")}
            />
            未收（保留 24h）
          </label>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending && <Spinner />}
        {pending ? "送出中…" : "建立訂位"}
      </button>
    </form>
  );
}
