"use client";

import { useState } from "react";
import WeekSchedule, { type WeekBooking, type WeekCourt } from "@/components/WeekSchedule";
import BookingEditModal, { type ModalBooking } from "./BookingEditModal";

export default function AdminWeekSchedule({ courts }: { courts: WeekCourt[] }) {
  const [selected, setSelected] = useState<WeekBooking | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <WeekSchedule
        mode="admin"
        courts={courts}
        refreshKey={refreshKey}
        onBookingClick={setSelected}
      />
      {selected && (
        <BookingEditModal
          booking={selected as ModalBooking}
          onClose={() => setSelected(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}
