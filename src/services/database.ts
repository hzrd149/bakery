import LocalDatabase from "../app/database.js";
import { DATA_PATH } from "../env.js";

// setup database
const database = new LocalDatabase({ directory: DATA_PATH });

export default database;
