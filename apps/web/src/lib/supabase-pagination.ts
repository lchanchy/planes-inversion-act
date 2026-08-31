import type { PostgrestError } from "@supabase/supabase-js";

export type PageResult<T> = { data: T[] | null; error: PostgrestError | null };

export async function fetchAllPages<T>(
  request: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500
): Promise<PageResult<T>> {
  const data: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await request(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };
    const rows = page.data ?? [];
    data.push(...rows);
    if (rows.length < pageSize) return { data, error: null };
  }
}
