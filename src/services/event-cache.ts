import bakeryDatabase from "../db/database.js";
import { SQLiteEventStore } from "../sqlite/event-store.js";

const eventCache = new SQLiteEventStore(bakeryDatabase);

export default eventCache;
