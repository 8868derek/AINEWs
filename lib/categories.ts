export const FEED_CATEGORIES = [
  { id: "ai-models", label: "模型" },
  { id: "ai-products", label: "产品" },
  { id: "industry", label: "行业" },
  { id: "paper", label: "论文" },
  { id: "tip", label: "教程" },
  { id: "opinion", label: "观点" },
];

const CATEGORY_LABELS = Object.fromEntries(FEED_CATEGORIES.map((item) => [item.id, item.label]));

export function categoryLabel(category: string | null) {
  if (!category) return "动态";
  return CATEGORY_LABELS[category] ?? category;
}
