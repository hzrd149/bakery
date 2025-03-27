import { SQLiteEventStore } from "../sqlite/event-store.js";
import database from "./database.js";

const eventCache = new SQLiteEventStore(database.db);
await eventCache.setup();

export default eventCache;
