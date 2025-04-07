import { Filter } from "nostr-tools";
import { eq, sql, desc, isNull, and } from "drizzle-orm";

import { mapParams } from "../helpers/sql.js";
import database from "./database.js";
import { schema } from "./index.js";

const isFilterKeyIndexableTag = (key: string) => {
  return key[0] === "#" && key.length === 2;
};
const isFilterKeyIndexableAndTag = (key: string) => {
  return key[0] === "&" && key.length === 2;
};

export const eventQuery = database.query.events
  .findFirst({
    where: (events, { eq }) => eq(events.id, sql.placeholder("id")),
  })
  .prepare();

export const addressableQuery = database.query.events
  .findFirst({
    where: (events, { eq }) =>
      and(
        eq(events.kind, sql.placeholder("kind")),
        eq(events.pubkey, sql.placeholder("pubkey")),
        eq(events.identifier, sql.placeholder("identifier")),
      ),
    orderBy: [desc(schema.events.created_at), desc(schema.events.id)],
  })
  .prepare();
export const addressableHistoryQuery = database.query.events
  .findMany({
    where: (events, { eq }) =>
      and(
        eq(events.kind, sql.placeholder("kind")),
        eq(events.pubkey, sql.placeholder("pubkey")),
        eq(events.identifier, sql.placeholder("identifier")),
      ),
    orderBy: [desc(schema.events.created_at), desc(schema.events.id)],
  })
  .prepare();

export const replaceableQuery = database.query.events
  .findFirst({
    where: (events, { eq, isNull }) =>
      and(
        eq(events.kind, sql.placeholder("kind")),
        eq(events.pubkey, sql.placeholder("pubkey")),
        isNull(events.identifier),
      ),
    orderBy: [desc(schema.events.created_at), desc(schema.events.id)],
  })
  .prepare();
export const replaceableHistoryQuery = database.query.events
  .findMany({
    where: (events, { eq, isNull }) =>
      and(
        eq(events.kind, sql.placeholder("kind")),
        eq(events.pubkey, sql.placeholder("pubkey")),
        isNull(events.identifier),
      ),
    orderBy: [desc(schema.events.created_at), desc(schema.events.id)],
  })
  .prepare();

function buildConditionsForFilter(filter: Filter) {
  const joins: string[] = [];
  const conditions: string[] = [];
  const parameters: (string | number)[] = [];
  const groupBy: string[] = [];
  const having: string[] = [];

  // get AND tag filters
  const andTagQueries = Object.keys(filter).filter(isFilterKeyIndexableAndTag);
  // get OR tag filters and remove any ones that appear in the AND
  const orTagQueries = Object.keys(filter)
    .filter(isFilterKeyIndexableTag)
    .filter((t) => !andTagQueries.includes(t));

  if (orTagQueries.length > 0) {
    joins.push("INNER JOIN tags as or_tags ON events.id = or_tags.event");
  }
  if (andTagQueries.length > 0) {
    joins.push("INNER JOIN tags as and_tags ON events.id = and_tags.event");
  }
  if (filter.search) {
    joins.push("INNER JOIN events_fts ON events_fts.id = events.id");

    conditions.push(`events_fts MATCH ?`);
    parameters.push('"' + filter.search.replace(/"/g, '""') + '"');
  }

  if (typeof filter.since === "number") {
    conditions.push(`events.created_at >= ?`);
    parameters.push(filter.since);
  }

  if (typeof filter.until === "number") {
    conditions.push(`events.created_at < ?`);
    parameters.push(filter.until);
  }

  if (filter.ids) {
    conditions.push(`events.id IN ${mapParams(filter.ids)}`);
    parameters.push(...filter.ids);
  }

  if (filter.kinds) {
    conditions.push(`events.kind IN ${mapParams(filter.kinds)}`);
    parameters.push(...filter.kinds);
  }

  if (filter.authors) {
    conditions.push(`events.pubkey IN ${mapParams(filter.authors)}`);
    parameters.push(...filter.authors);
  }

  // add AND tag filters
  for (const t of andTagQueries) {
    conditions.push(`and_tags.tag = ?`);
    parameters.push(t.slice(1));

    // @ts-expect-error
    const v = filter[t] as string[];
    conditions.push(`and_tags.value IN ${mapParams(v)}`);
    parameters.push(...v);
  }

  // add OR tag filters
  for (let t of orTagQueries) {
    conditions.push(`or_tags.tag = ?`);
    parameters.push(t.slice(1));

    // @ts-expect-error
    const v = filter[t] as string[];
    conditions.push(`or_tags.value IN ${mapParams(v)}`);
    parameters.push(...v);
  }

  // if there is an AND tag filter set GROUP BY so that HAVING can be used
  if (andTagQueries.length > 0) {
    groupBy.push("events.id");
    having.push("COUNT(and_tags.id) = ?");

    // @ts-expect-error
    parameters.push(andTagQueries.reduce((t, k) => t + (filter[k] as string[]).length, 0));
  }

  return { conditions, parameters, joins, groupBy, having };
}

export function buildSQLQueryForFilters(filters: Filter[], select = "events.*") {
  let stmt = `SELECT ${select} FROM events `;

  const orConditions: string[] = [];
  const parameters: any[] = [];
  const groupBy = new Set<string>();
  const having = new Set<string>();

  let joins = new Set<string>();
  for (const filter of filters) {
    const parts = buildConditionsForFilter(filter);

    if (parts.conditions.length > 0) {
      orConditions.push(`(${parts.conditions.join(" AND ")})`);
      parameters.push(...parts.parameters);

      for (const join of parts.joins) joins.add(join);
      for (const group of parts.groupBy) groupBy.add(group);
      for (const have of parts.having) having.add(have);
    }
  }

  stmt += Array.from(joins).join(" ");

  if (orConditions.length > 0) {
    stmt += ` WHERE ${orConditions.join(" OR ")}`;
  }

  if (groupBy.size > 0) {
    stmt += " GROUP BY " + Array.from(groupBy).join(",");
  }
  if (having.size > 0) {
    stmt += " HAVING " + Array.from(having).join(" AND ");
  }

  // @ts-expect-error
  const order = filters.find((f) => f.order)?.order;
  if (filters.some((f) => f.search) && (order === "rank" || order === undefined)) {
    stmt = stmt + " ORDER BY rank";
  } else {
    stmt = stmt + " ORDER BY created_at DESC";
  }

  let minLimit = Infinity;
  for (const filter of filters) {
    if (filter.limit) minLimit = Math.min(minLimit, filter.limit);
  }
  if (minLimit !== Infinity) {
    stmt += " LIMIT ?";
    parameters.push(minLimit);
  }

  return { stmt, parameters };
}

// New code using drizzle
// function buildConditionsForFilter(filter: Filter) {
//   const conditions: (SQL | undefined)[] = [];

//   // Handle tag filters
//   const andTagQueries = Object.keys(filter).filter(isFilterKeyIndexableAndTag);
//   const orTagQueries = Object.keys(filter)
//     .filter(isFilterKeyIndexableTag)
//     .filter((t) => !andTagQueries.includes(t));

//   if (filter.since) conditions.push(gte(events.createdAt, filter.since));
//   if (filter.until) conditions.push(lt(events.createdAt, filter.until));

//   if (filter.ids) conditions.push(inArray(events.id, filter.ids));
//   if (filter.kinds) conditions.push(inArray(events.kind, filter.kinds));
//   if (filter.authors) conditions.push(inArray(events.pubkey, filter.authors));

//   // Add tag conditions
//   if (orTagQueries.length > 0) {
//     const orConditions = orTagQueries.map((t) => {
//       // @ts-expect-error
//       const values = filter[t] as string[];
//       return and(eq(tags.tagag, t.slice(1)), inArray(tags.valuealue, values));
//     });
//     conditions.push(or(...orConditions));
//   }

//   if (andTagQueries.length > 0) {
//     andTagQueries.forEach((t) => {
//       // @ts-expect-error
//       const values = filter[t] as string[];
//       conditions.push(and(eq(tags.tagag, t.slice(1)), inArray(tags.valuealue, values)));
//     });
//   }

//   return conditions;
// }

// export function buildDrizzleQueryForFilters(filters: (Filter & { order?: "rank" | "createdAt" })[]) {
//   const filterConditions = filters.map((filter) => and(...buildConditionsForFilter(filter)));

//   let baseQuery = bakeryDatabase.select().from(events).leftJoin(tags, eq(events.id, tags.event));

//   if (filterConditions.length > 0) {
//     baseQuery = baseQuery.where(or(...filterConditions));
//   }

//   // Handle ordering
//   const order = filters.find((f) => f.order)?.order;
//   if (filters.some((f) => f.search) && (!order || order === "rank")) {
//     baseQuery = baseQuery.orderBy(sql`rank`);
//   } else {
//     baseQuery = baseQuery.orderBy(desc(events.createdAt));
//   }

//   // Handle limit
//   const minLimit = Math.min(...filters.map((f) => f.limit || Infinity));
//   if (minLimit !== Infinity) {
//     baseQuery = baseQuery.limit(minLimit);
//   }

//   return baseQuery;
// }
