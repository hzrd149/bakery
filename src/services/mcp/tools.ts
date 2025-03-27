import z from "zod";
import { kinds } from "nostr-tools";

import server from "./server.js";
import eventCache from "../event-cache.js";

server.tool(
  "Search events",
  "Search events by kind and query",
  {
    query: z.string(),
    kind: z.number().optional().default(kinds.ShortTextNote),
    limit: z.number().optional().default(50),
  },
  async ({ query, kind, limit }) => {
    const events = eventCache.getEventsForFilters([{ kinds: [kind], search: query, limit }]);

    return {
      content: events.map((event) => {
        return {
          type: "text",
          text: JSON.stringify(event),
        };
      }),
    };
  },
);
