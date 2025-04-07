import { animals, colors, adjectives, uniqueNamesGenerator } from "unique-names-generator";
import path from "node:path";
import { TBakeryConfig, ZBakeryConfig } from "nostr-bakery-common";

import { DATA_PATH } from "../env.js";
import { ReactiveJsonFile } from "../classes/json-file.js";

const defaultConfig = ZBakeryConfig.parse({});

const bakeryConfig = new ReactiveJsonFile<TBakeryConfig>(path.join(DATA_PATH, "node.json"), defaultConfig);
bakeryConfig.read();

// explicitly set the default values
bakeryConfig.setDefaults(defaultConfig);

// set a new name if it is not set
if (!bakeryConfig.data.name) {
  bakeryConfig.data.name = uniqueNamesGenerator({ dictionaries: [colors, adjectives, animals] });
}

export default bakeryConfig;
