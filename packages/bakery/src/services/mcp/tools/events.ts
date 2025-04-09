import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getProfileContent } from "applesauce-core/helpers";
import { Filter, kinds } from "nostr-tools";
import z from "zod";

import bakeryConfig from "../../bakery-config.js";
import eventCache from "../../event-cache.js";
import { asyncLoader } from "../../loaders.js";
import { ownerFactory, ownerPublish } from "../../owner-signer.js";
import { eventInput, userInput } from "../inputs.js";
import mcpServer from "../server.js";

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
  "Search for events using a sqlite FTS5 search query",
  {
    query: z.string().describe("The sqlite FTS5 search query"),
    kind: z.number().default(1).describe("The kind of events to search for"),
    limit: z.number().default(50).describe("The number of events to return"),
    author: userInput.optional().describe("The author of the events to search for"),
  },
  async ({ query, kind, limit, author }) => {
    const filter: Filter = { kinds: [kind], limit, search: query };
    if (author) filter.authors = [author];

    const events = await eventCache.getEventsForFilters([filter]);

    return {
      content: events.map((event) => ({ type: "text", text: JSON.stringify(event) })),
    };
  },
);

// TODO: this needs to accept naddr, and nevent
mcpServer.tool("get_event_json", "Gets the full event as json", { event: eventInput }, async ({ event }) => {
  return {
    content: [{ type: "text", text: JSON.stringify(event) }],
  };
});

mcpServer.tool(
  "search_users",
  "Search for users using a sqlite FTS5 search query",
  {
    query: z.string().describe("The sqlite FTS5 search query"),
    limit: z.number().default(20).describe("The number of users to return"),
  },
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
    user: userInput.describe("The user to get events for"),
    limit: z.number().default(10).describe("The number of events to return"),
    kinds: z.array(z.number()).default([kinds.ShortTextNote]).describe("The kind number of events to return"),
    since: z.number().optional().describe("The unix timestamp to start the search from"),
    until: z.number().optional().describe("The unix timestamp to end the search at"),
  },
  async ({ user, limit, kinds, since, until }) => {
    const events = await eventCache.getEventsForFilters([{ authors: [user], limit, kinds, since, until }]);

    return {
      content: events.map((event) => ({ type: "text", text: JSON.stringify(event) })),
    };
  },
);

mcpServer.tool(
  "get_events_user_mentioned",
  "Gets a list of recent events that the user is mentioned in",
  {
    user: userInput.describe("The user who is mentioned in the events"),
    limit: z.number().default(10).describe("The number of events to return"),
    kinds: z.array(z.number()).default([kinds.ShortTextNote]).describe("The kind number of events to return"),
    since: z.number().optional().describe("The unix timestamp to start the search from"),
    until: z.number().optional().describe("The unix timestamp to end the search at"),
  },
  async ({ user, limit, kinds, since, until }) => {
    const events = await eventCache.getEventsForFilters([{ "#p": [user], limit, kinds, since, until }]);

    return {
      content: events.map((event) => ({ type: "text", text: JSON.stringify(event) })),
    };
  },
);
