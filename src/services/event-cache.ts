import { SQLiteEventStore } from "../sqlite/event-store.js";
import database from "./database.js";

const sqliteEventStore = new SQLiteEventStore(database.db);
await sqliteEventStore.setup();

export default sqliteEventStore;
