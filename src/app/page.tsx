import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { getPriceRange } from "@/lib/pricing";

const features = [
  {
    icon: "📅",
    title: "線上訂場",
    desc: "隨時查空檔、即時訂，24 小時不打烊，免排隊免電話。",
    href: "/bookings/create",
  },
  {
    icon: "🧵",
    title: "穿線寄拍",
    desc: "斷線丟進 24h 拍櫃，穿好 LINE 通知你來拿。",
    href: "https://shop.dearfly.com.tw/order",
  },
  {
    icon: "🛒",
    title: "用品補給",
    desc: "球、握把布、泡麵，無人店自取，半夜也開。",
    href: "https://shop.dearfly.com.tw/store",
  },
];

export default async function Home() {
  let courts = await prisma.court.findMany({
    where: { status: "active", venue: { status: "active" }, featured: true },
    orderBy: { name: "asc" },
    include: {
      venue: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  // 若沒有任何精選場地，回退顯示前 3 個
  if (courts.length === 0) {
    courts = await prisma.court.findMany({
      where: { status: "active", venue: { status: "active" } },
      orderBy: { name: "asc" },
      take: 3,
      include: {
        venue: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });
  }

  const featured = await Promise.all(
    courts.map(async (c) => {
      const range = await getPriceRange(c.venueId, c.pricePerHour);
      return { ...c, priceMin: range.min, priceMax: range.max };
    })
  );

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            24 小時，說打就打
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-emerald-50">
            訂場・穿線・補給 24 小時不打烊，一條 LINE 全搞定。
          </p>
          <div className="mt-8">
            <Link
              href="/bookings/create"
              className="rounded-full bg-white px-8 py-3 text-base font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
            >
              現在訂場
            </Link>
          </div>
        </div>
      </section>

      {/* 賣點卡片 */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              {f.href.startsWith("http") ? (
                <a
                  href={f.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
                >
                  前往 →
                </a>
              ) : (
                <Link
                  href={f.href}
                  className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
                >
                  前往 →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 精選場地 */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">精選場地</h2>
          <Link
            href="/courts"
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            查看全部場地 →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {featured.map((court) => (
            <Link
              key={court.id}
              href={`/bookings/create?courtId=${court.id}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
                {court.images[0] ? (
                  <Image
                    src={court.images[0].url}
                    alt={court.name}
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
              <div className="p-5">
                <h3 className="font-semibold text-slate-900">
                  {court.venue.name} · {court.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  📍 {court.venue.location ?? court.venue.name}
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  {formatPrice(court.priceMin)}
                  {court.priceMax > court.priceMin
                    ? ` ~ ${formatPrice(court.priceMax)}`
                    : ""}{" "}
                  / 小時
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 營業時間 */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h2 className="text-lg font-semibold">營業時間</h2>
          <p className="mt-2 text-slate-600">
            線上訂位・穿線・補給：24 小時不打烊 ｜ 場地時段依各場地公告（早鳥 06:30 起）
          </p>
        </div>
      </section>
    </div>
  );
}
