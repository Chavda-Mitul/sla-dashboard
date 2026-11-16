/** Whole UTC days. `from`/`to` are YYYY-MM-DD, or "" when unset. */
export interface DateFilter {
  mode: "all" | "day" | "range";
  from: string;
  to: string;
}

export const ALL_DATES: DateFilter = { mode: "all", from: "", to: "" };

/** The query range a filter means: undefined = unbounded on that side. */
export function rangeOf(filter: DateFilter): { from?: string; to?: string } {
  if (filter.mode === "day" && filter.from) return { from: filter.from, to: filter.from };
  if (filter.mode === "range") return { from: filter.from || undefined, to: filter.to || undefined };
  return {};
}
