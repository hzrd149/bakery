import { SQLiteEventStore } from "@satellite-earth/core";
import database from "./database.js";

const eventCache = new SQLiteEventStore(database.db);
await eventCache.setup();

export default eventCache;
