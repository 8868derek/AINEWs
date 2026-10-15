"use client";

export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="py-8">
      <h1 className="font-serif text-3xl">这一页没有打开</h1>
      <p className="mt-3 leading-7 text-stone-600">{error.message || "后端没有及时返回。"}</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-cinnabar px-4 py-2 text-sm font-medium text-white">
        再试一次
      </button>
    </section>
  );
}
