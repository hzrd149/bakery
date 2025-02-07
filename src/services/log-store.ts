import LogStore from "../modules/log-store/log-store.js";
import database from "./database.js";

const logStore = new LogStore(database.db);
await logStore.setup();

export default logStore;
