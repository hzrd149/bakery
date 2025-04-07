import { z } from "zod";
import { ZBakeryConfig } from "./bakery-config.js";

// Base network state
export const ZNetworkOutboundState = z.object({
  available: z.boolean(),
  running: z.boolean().optional(),
  error: z.string().optional(),
});
export const ZNetworkInboundState = z.object({
  available: z.boolean(),
  running: z.boolean().optional(),
  error: z.string().optional(),
  address: z.string().optional(),
});
export const ZNetworkState = z.object({
  inbound: ZNetworkInboundState,
  outbound: ZNetworkOutboundState,
});

// Logs
export const ZLogFilter = z
  .object({
    service: z.string(),
    since: z.number(),
    until: z.number(),
    limit: z.number(),
  })
  .partial();
export const ZLogEntry = z.object({
  id: z.string(),
  service: z.string(),
  message: z.string(),
  timestamp: z.number().nullable().optional(),
});

// Create a map of query schemas (0 = input, 1 = output)
export const ZBakeryQueries = {
  config: [z.undefined(), ZBakeryConfig],
  services: [z.undefined(), z.array(z.string())],
  connections: [z.undefined(), z.record(z.string(), z.object({ connected: z.boolean(), authenticated: z.boolean() }))],
  logs: [ZLogFilter.optional(), ZLogEntry],
  "network-status": [
    z.undefined(),
    z.object({
      tor: ZNetworkState,
      hyper: ZNetworkState,
      i2p: ZNetworkState,
    }),
  ],
} as const;

// Export types
export type TBakeryQueries = {
  [k in keyof typeof ZBakeryQueries]: [z.infer<(typeof ZBakeryQueries)[k][0]>, z.infer<(typeof ZBakeryQueries)[k][1]>];
};
