import Link from "next/link";

export default function LineLoginButton() {
  return (
    <Link
      href="/api/auth/line/start"
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] font-medium text-white transition-colors hover:bg-[#05a848]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 5.9 2 10.72c0 4.31 3.82 7.92 8.98 8.6.35.08.83.24.95.55.11.29.07.74.04 1.03 0 .29-.13 1.28.13 1.43.26.15.95-.62 1.57-.94 1.44-.74 2.81-1.82 3.83-3.1.72-.92 1.13-1.96 1.13-3.06 1.14.05 2.18-.31 3.02-1.03C21.6 14.7 22 13.77 22 12.75 22 7.94 17.52 2 12 2zM8.5 12.29c-.5 0-.9-.42-.9-.94s.4-.94.9-.94.9.42.9.94-.4.94-.9.94zm3.5 0c-.5 0-.9-.42-.9-.94s.4-.94.9-.94.9.42.9.94-.4.94-.9.94zm3.5 0c-.5 0-.9-.42-.9-.94s.4-.94.9-.94.9.42.9.94-.4.94-.9.94z" />
      </svg>
      使用 LINE 登入
    </Link>
  );
}
