import ApplicationStateManager from "../modules/state/application-state-manager.js";
import database from "./database.js";

const stateManager = new ApplicationStateManager(database.db);
await stateManager.setup();

export default stateManager;
