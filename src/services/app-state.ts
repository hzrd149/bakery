import ApplicationStateManager from "../modules/application-state/manager.js";
import bakeryDatabase from "../db/index.js";

const stateManager = new ApplicationStateManager(bakeryDatabase);

export default stateManager;
