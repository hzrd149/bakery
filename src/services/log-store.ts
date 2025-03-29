import LogStore from "../modules/log-store/log-store.js";
import bakeryDatabase from "../db/index.js";

const logStore = new LogStore(bakeryDatabase);

export default logStore;
