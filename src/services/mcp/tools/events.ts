import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getProfileContent } from "applesauce-core/helpers";
import { kinds } from "nostr-tools";
import { lastValueFrom, toArray } from "rxjs";
import z from "zod";

import server from "../server.js";
import { ownerFactory } from "../../owner.js";
import { rxNostr } from "../../rx-nostr.js";
import { requestLoader } from "../../loaders.js";
import config from "../../config.js";
import eventCache from "../../event-cache.js";

server.tool(
  "sign_draft_event",
  "Signs a draft note event with the owners pubkey",
  {
    draft: z.object({
      content: z.string(),
      created_at: z.number(),
      tags: z.array(z.array(z.string())),
      kind: z.number(),
    }),
  },
  async ({ draft }) => {
    const unsigned = await ownerFactory.stamp(draft);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(await ownerFactory.sign(unsigned)),
        },
      ],
    };
  },
);

server.tool(
  "publish_event",
  "Publishes a signed nostr event to the relays or the users outbox relays",
  {
    event: z
      .object({
        created_at: z.number(),
        content: z.string(),
        tags: z.array(z.array(z.string())),
        kind: z.number(),
        sig: z.string(),
        pubkey: z.string().length(64),
      })
      .describe("The nostr event to publish"),
    relays: z.array(z.string().url()).optional().describe("An array of relays to publish to"),
  },
  async ({ event, relays }) => {
    if (!config.data.owner) throw new Error("Owner not set");

    relays = relays || (await requestLoader.mailboxes({ pubkey: config.data.owner })).outboxes;
    const results = await lastValueFrom(rxNostr.send(event, { on: { relays } }).pipe(toArray()));

    return {
      content: results.map((result) => ({
        type: "text",
        text: `${result.from} ${result.ok ? "Success" : "Failed"}: ${result.message}`,
      })),
    };
  },
);

server.tool(
  "search_events",
  "Search for events of a certain kind that contain the query",
  { query: z.string(), kind: z.number().default(1), limit: z.number().default(50) },
  async ({ query, kind, limit }) => {
    const events = await eventCache.getEventsForFilters([{ kinds: [kind], limit, search: query }]);

    return {
      content: events.map((event) => ({ type: "text", text: JSON.stringify(event) })),
    };
  },
);

// TODO: this needs to accept naddr, and nevent
server.tool("get_event", "Get an event by id", { id: z.string().length(64) }, async ({ id }) => {
  const event = await eventCache.getEventsForFilters([{ ids: [id] }]);

  return {
    content: [{ type: "text", text: JSON.stringify(event) }],
  };
});

server.tool(
  "search_user_pubkey",
  "Search for users pubkeys that match the query",
  { query: z.string(), limit: z.number().default(10) },
  async ({ query, limit }) => {
    const profiles = await eventCache.getEventsForFilters([{ search: query, kinds: [kinds.Metadata], limit }]);

    return {
      content: profiles.map((profile) => {
        const content = getProfileContent(profile);
        const text = [
          `Pubkey: ${profile.pubkey}`,
          content.name && `Name: ${content.name}`,
          content.about && `About: ${content.about}`,
          content.picture && `Picture: ${content.picture}`,
          content.nip05 && `NIP-05: ${content.nip05}`,
          content.website && `Website: ${content.website}`,
        ]
          .filter(Boolean)
          .join("\n");

        return {
          type: "text",
          text,
        } satisfies CallToolResult["content"][number];
      }),
    };
  },
);
