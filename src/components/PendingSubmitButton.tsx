"use client";

import { useFormStatus } from "react-dom";
import Spinner from "./Spinner";

/** 表單送出中自動轉圈＋鎖住（防重複點擊）。需放在 <form> 內。 */
export default function PendingSubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-1.5 ${className ?? ""} ${
        pending ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
