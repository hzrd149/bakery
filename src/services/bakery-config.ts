import { animals, colors, adjectives, uniqueNamesGenerator } from "unique-names-generator";
import path from "node:path";
import { z } from "zod";

import { DATA_PATH } from "../env.js";
import { ReactiveJsonFile } from "../classes/json-file.js";

export const bakeryConfigSchema = z.object({
  name: z.string().default("").describe("The name of the bakery node"),
  description: z.string().default("").describe("A short description of the bakery node"),

  owner: z.string().optional(),
  public_address: z.string().url().optional(),

  // legacy config (unused)
  requireReadAuth: z.boolean().default(false),
  publicAddresses: z.array(z.string().url()).default([]),
  autoListen: z.boolean().default(false),
  logsEnabled: z.boolean().default(false),

  // receiver config
  receiverEnabled: z.boolean().default(true),

  // nostr network config
  bootstrap_relays: z.array(z.string().url()).optional(),
  lookup_relays: z.array(z.string().url()).optional(),

  // hyper config
  hyperEnabled: z.boolean().default(false),

  // tor config
  enableTorConnections: z.boolean().default(true),
  enableI2PConnections: z.boolean().default(true),
  enableHyperConnections: z.boolean().default(false),
  routeAllTrafficThroughTor: z.boolean().default(false),

  // gossip config
  gossipEnabled: z.boolean().default(false),
  gossipInterval: z.number().default(10 * 60_000),
  gossipBroadcastRelays: z.array(z.string().url()).default([]),
});

export type BakeryConfig = z.infer<typeof bakeryConfigSchema>;

const defaultConfig: BakeryConfig = bakeryConfigSchema.parse({});

const bakeryConfig = new ReactiveJsonFile<BakeryConfig>(path.join(DATA_PATH, "node.json"), defaultConfig);
bakeryConfig.read();

// explicitly set the default values
bakeryConfig.setDefaults(defaultConfig);

// set a new name if it is not set
if (!bakeryConfig.data.name) {
  bakeryConfig.data.name = uniqueNamesGenerator({ dictionaries: [colors, adjectives, animals] });
}

export default bakeryConfig;
