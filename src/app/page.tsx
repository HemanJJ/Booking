import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { getPriceRange } from "@/lib/pricing";

const features = [
  {
    icon: "📅",
    title: "線上預約",
    desc: "隨時隨地查詢空檔，即時預訂，免排隊免電話。",
  },
  {
    icon: "🏟️",
    title: "多元場地",
    desc: "羽球、籃球、桌球等場地一站搞定，滿足各種運動需求。",
  },
  {
    icon: "🔒",
    title: "安全可靠",
    desc: "防重疊訂位機制，確保每一筆預約都有保障。",
  },
];

export default async function Home() {
  const courts = await prisma.court.findMany({
    where: { status: "active", venue: { status: "active" } },
    orderBy: { name: "asc" },
    take: 3,
    include: {
      venue: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

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
            線上預約，輕鬆開打
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-emerald-50">
            羽球、籃球、桌球等多元場地，動動手指就能完成預約。
          </p>
          <div className="mt-8">
            <Link
              href="/courts"
              className="rounded-full bg-white px-8 py-3 text-base font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
            >
              立即預約
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
              href={`/courts/${court.id}`}
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
            各場地每日 08:00 – 22:00（實際時段以各場地公告為準）
          </p>
        </div>
      </section>
    </div>
  );
}
