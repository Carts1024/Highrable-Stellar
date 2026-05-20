import { api } from "@repo/backend/convex/_generated/api";

import type { Doc, Id, TableNames } from "@repo/backend/convex/_generated/dataModel";

export type TConvexTableName = TableNames;
export type TConvexDoc<TTableName extends TConvexTableName> = Doc<TTableName>;
export type TConvexId<TTableName extends TConvexTableName> = Id<TTableName>;

export { api };
