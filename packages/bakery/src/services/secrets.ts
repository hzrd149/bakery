import path from "node:path";

import SecretsManager from "../modules/secrets-manager.js";
import { DATA_PATH } from "../env.js";

const secrets = new SecretsManager(path.join(DATA_PATH, "secrets.json"));
secrets.read();

export default secrets;
