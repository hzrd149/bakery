import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getProfileContent } from "applesauce-core/helpers";
import { kinds } from "nostr-tools";
import z from "zod";

import mcpServer from "../server.js";
import { ownerFactory, ownerPublish } from "../../owner-signer.js";
import bakeryConfig from "../../config.js";
import eventCache from "../../event-cache.js";
import { normalizeToHexPubkey } from "../../../helpers/nip19.js";
import { asyncLoader } from "../../loaders.js";

mcpServer.tool(
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

mcpServer.tool(
  "publish_event",
  "Publishes a signed nostr event to the relays or the users outbox relays",
  {
    event: z
      .object({
        id: z.string().length(64),
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
    if (!bakeryConfig.data.owner) throw new Error("Owner not set");

    relays = relays || (await asyncLoader.outboxes(bakeryConfig.data.owner));
    const results = await ownerPublish(event, relays);
    if (!results) throw new Error("Failed to publish event to relays");

    return {
      content: results.map((result) => ({
        type: "text",
        text: `${result.ok ? "Success" : "Failed"} ${result.from} ${result.notice ?? ""}`,
      })),
    };
  },
);

mcpServer.tool(
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
mcpServer.tool("get_event", "Get an event by id", { id: z.string().length(64) }, async ({ id }) => {
  const event = await eventCache.getEventsForFilters([{ ids: [id] }]);

  return {
    content: [{ type: "text", text: JSON.stringify(event) }],
  };
});

mcpServer.tool(
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

mcpServer.tool(
  "get_users_recent_events",
  "Gets a list of recent events created by a pubkey",
  {
    pubkey: z
      .string()
      .transform((hex) => normalizeToHexPubkey(hex, true))
      .describe("The pubkey of the user to get events for"),
    limit: z.number().default(10).describe("The number of events to return"),
    kinds: z.array(z.number()).default([kinds.ShortTextNote]).describe("The kind number of events to return"),
    since: z.number().optional().describe("The unix timestamp to start the search from"),
    until: z.number().optional().describe("The unix timestamp to end the search at"),
  },
  async ({ pubkey, limit, kinds, since, until }) => {
    const events = await eventCache.getEventsForFilters([{ authors: [pubkey], limit, kinds, since, until }]);

    return {
      content: events.map((event) => ({ type: "text", text: JSON.stringify(event) })),
    };
  },
);

mcpServer.tool(
  "get_events_pubkey_mentioned",
  "Gets a list of recent events that the pubkey was mentioned in",
  {
    pubkey: z
      .string()
      .transform((hex) => normalizeToHexPubkey(hex, true))
      .describe("The pubkey of the user to get events for"),
    limit: z.number().default(10).describe("The number of events to return"),
    kinds: z.array(z.number()).default([kinds.ShortTextNote]).describe("The kind number of events to return"),
    since: z.number().optional().describe("The unix timestamp to start the search from"),
    until: z.number().optional().describe("The unix timestamp to end the search at"),
  },
  async ({ pubkey, limit, kinds, since, until }) => {
    const events = await eventCache.getEventsForFilters([{ "#p": [pubkey], limit, kinds, since, until }]);

    return {
      content: events.map((event) => ({ type: "text", text: JSON.stringify(event) })),
    };
  },
);
