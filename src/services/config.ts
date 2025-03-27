import path from "node:path";

import ConfigManager from "../modules/config/config-manager.js";
import { DATA_PATH } from "../env.js";

const config = new ConfigManager(path.join(DATA_PATH, "node.json"));

config.read();

export default config;
