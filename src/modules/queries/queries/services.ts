import { from, merge, NEVER } from "rxjs";
import database from "../../../services/database.js";
import { Query } from "../types.js";

export const ServicesQuery: Query<string[]> = () =>
  merge(NEVER, from(database.db.prepare<[], { id: string }>(`SELECT service as id FROM logs GROUP BY service`).all()));
