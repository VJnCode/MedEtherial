import type { Model, PopulateOptions, SortOrder } from 'mongoose';

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export async function paginate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  filter: Record<string, unknown>,
  opts: {
    page: number;
    limit: number;
    sort?: Record<string, SortOrder>;
    populate?: PopulateOptions | (PopulateOptions | string)[] | string;
    projection?: Record<string, 0 | 1>;
  },
): Promise<Page<unknown>> {
  const query = model
    .find(filter, opts.projection)
    .sort(opts.sort ?? { createdAt: -1 })
    .skip((opts.page - 1) * opts.limit)
    .limit(opts.limit);
  if (opts.populate) query.populate(opts.populate as never);
  const [items, total] = await Promise.all([query.exec(), model.countDocuments(filter)]);
  return { items, page: opts.page, limit: opts.limit, total, pages: Math.max(1, Math.ceil(total / opts.limit)) };
}
