import { JSONFileSync } from "lowdb/node";
import _throttle from "lodash.throttle";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { PrivateNodeConfig } from "@satellite-earth/core/types/private-node-config.js";

import { logger } from "../logger.js";
import { ReactiveJsonFileSync } from "../classes/json-file.js";

export const defaultConfig: PrivateNodeConfig = {
  name: uniqueNamesGenerator({
    dictionaries: [colors, adjectives, animals],
  }),
  description: "",

  autoListen: false,
  runReceiverOnBoot: true,
  runScrapperOnBoot: false,
  logsEnabled: true,
  requireReadAuth: false,
  publicAddresses: [],

  hyperEnabled: false,

  enableTorConnections: true,
  enableI2PConnections: true,
  enableHyperConnections: false,
  routeAllTrafficThroughTor: false,

  gossipEnabled: false,
  gossipInterval: 10 * 60_000,
  gossipBroadcastRelays: [],
};

export default class ConfigManager extends ReactiveJsonFileSync<PrivateNodeConfig> {
  log = logger.extend("ConfigManager");

  constructor(path: string) {
    super(new JSONFileSync(path), defaultConfig);

    this.on("loaded", (config) => {
      // explicitly set default values if fields are not set
      for (const [key, value] of Object.entries(defaultConfig)) {
        // @ts-expect-error
        if (config[key] === undefined) {
          // @ts-expect-error
          config[key] = value;
        }
      }

      this.write();
    });
  }

  setField(field: keyof PrivateNodeConfig, value: any) {
    this.log(`Setting ${field} to ${value}`);
    // @ts-expect-error
    this.data[field] = value;

    this.write();
  }
}
