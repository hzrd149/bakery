import { filter, from, interval, map, merge, NEVER, of } from "rxjs";
import { ZBakeryQueries } from "nostr-bakery-common";

import QueryManager from "../modules/queries/manager.js";
import bakeryConfig from "./bakery-config.js";
import { outboundNetwork } from "./network.js";
import { inboundNetwork } from "./network.js";
import { schema } from "../db/index.js";
import logStore from "./log-store.js";
import bakeryDatabase from "../db/index.js";
import { connections$ } from "./pool.js";

QueryManager.registerQuery("config", () => bakeryConfig.data$);
QueryManager.registerQuery("connections", () => connections$);
QueryManager.registerQuery("logs", (args) =>
  merge(
    // get last 500 lines
    from(logStore.getLogs({ service: args?.service, limit: 500 })),
    // subscribe to new logs
    logStore.insert$.pipe(
      // only return logs that match args
      filter((entry) => {
        return !args?.service || entry.service === args.service;
      }),
    ),
  ),
);

QueryManager.registerQuery("services", () =>
  merge(
    NEVER,
    of(
      bakeryDatabase
        .select()
        .from(schema.logs)
        .groupBy(schema.logs.service)
        .all()
        .map((row) => row.service),
    ),
  ),
);

QueryManager.registerQuery("network-status", () =>
  interval(1000).pipe(
    map(() => {
      const inbound = inboundNetwork;
      const outbound = outboundNetwork;

      return ZBakeryQueries["network-status"][1].parse({
        tor: {
          inbound: {
            available: inbound.tor.available,
            running: inbound.tor.running,
            error: inbound.tor.error?.message,
            address: inbound.tor.address,
          },
          outbound: {
            available: outbound.tor.available,
            running: outbound.tor.running,
            error: outbound.tor.error?.message,
          },
        },
        hyper: {
          inbound: {
            available: inbound.hyper.available,
            running: inbound.hyper.running,
            error: inbound.hyper.error?.message,
            address: inbound.hyper.address,
          },
          outbound: {
            available: outbound.hyper.available,
            running: outbound.hyper.running,
            error: outbound.hyper.error?.message,
          },
        },
        i2p: {
          inbound: {
            available: inbound.i2p.available,
            running: inbound.i2p.running,
            error: inbound.i2p.error?.message,
            address: inbound.i2p.address,
          },
          outbound: {
            available: outbound.i2p.available,
            running: outbound.i2p.running,
            error: outbound.i2p.error?.message,
          },
        },
      });
    }),
  ),
);
