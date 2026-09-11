import "server-only";
import { listCategories, listSubcategories, mapCategories, mapSubcategories } from "./smartscout";
import type { Category, SubcategoryNode } from "./types";

// Catalogs are public (no token) but marketplace-specific, so cache per marketplace.
const catCache = new Map<string, { at: number; rows: Category[] }>();
const subCache = new Map<string, { at: number; rows: SubcategoryNode[] }>();
const TTL_MS = 60 * 60 * 1000; // 1h — catalogs change rarely.

function fresh<T>(entry: { at: number; rows: T[] } | undefined): T[] | null {
  if (entry && Date.now() - entry.at < TTL_MS) return entry.rows;
  return null;
}

export async function getCategories(marketplace: string): Promise<Category[]> {
  const hit = fresh(catCache.get(marketplace));
  if (hit) return hit;
  const mapped = mapCategories(await listCategories(marketplace)) as { categories: Category[] };
  const rows = [...mapped.categories].sort((a, b) => a.name.localeCompare(b.name));
  catCache.set(marketplace, { at: Date.now(), rows });
  return rows;
}

export async function getSubcategories(marketplace: string): Promise<SubcategoryNode[]> {
  const hit = fresh(subCache.get(marketplace));
  if (hit) return hit;
  const mapped = mapSubcategories(await listSubcategories(marketplace)) as {
    subcategories: SubcategoryNode[];
  };
  // Drop synthetic negative-id nodes (mirrors of real browse nodes that the
  // brands query does not accept), then attach a breadcrumb path so entries
  // with identical leaf names (e.g. several "Yoga") are distinguishable.
  const rows = mapped.subcategories.filter((s) => s.id > 0);
  const byId = new Map<number, SubcategoryNode>();
  for (const r of rows) byId.set(r.id, r);
  for (const r of rows) {
    const parts: string[] = [];
    let cur: SubcategoryNode | undefined = r.parentId ? byId.get(r.parentId) : undefined;
    let guard = 0;
    while (cur && guard++ < 12) {
      parts.unshift(cur.shortName || cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    r.path = parts.length ? parts.join(" › ") : null;
  }
  subCache.set(marketplace, { at: Date.now(), rows });
  return rows;
}

/** Case-insensitive name search over the cached catalog, ranked and capped.
 *  A numeric query also matches a node id exactly. */
export async function searchSubcategories(
  marketplace: string,
  q: string,
  limit = 50,
): Promise<SubcategoryNode[]> {
  const all = await getSubcategories(marketplace);
  // Only isParent=false nodes return brands; aggregation parents return 0.
  const rows = all.filter((r) => r.isParent === false);
  const query = q.trim().toLowerCase();
  if (!query) {
    // No query: show the highest-revenue selectable subcategories as a default.
    return [...rows]
      .sort((a, b) => (b.totalMonthlyRevenue ?? 0) - (a.totalMonthlyRevenue ?? 0))
      .slice(0, limit);
  }

  const asId = Number(query);
  const scored: { row: SubcategoryNode; score: number }[] = [];
  for (const row of rows) {
    const name = row.name.toLowerCase();
    let score = -1;
    if (Number.isFinite(asId) && row.id === asId) score = 1000;
    else if (name === query) score = 100;
    else if (name.startsWith(query)) score = 50;
    else if (name.includes(query)) score = 20;
    if (score >= 0) {
      // Prefer leaf/deeper, revenue-heavy nodes within the same match tier.
      score += Math.min((row.totalMonthlyRevenue ?? 0) / 1e9, 10);
      scored.push({ row, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.row);
}
