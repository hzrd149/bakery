import { from, merge, NEVER } from "rxjs";
import { Query } from "../types.js";
import bakeryDatabase, { schema } from "../../../db/index.js";

export const ServicesQuery: Query<string[]> = () =>
  merge(
    NEVER,
    from(
      bakeryDatabase
        .select()
        .from(schema.logs)
        .groupBy(schema.logs.service)
        .all()
        .map((row) => row.service),
    ),
  );
