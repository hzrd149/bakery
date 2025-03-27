import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NoteBlueprint } from "applesauce-factory/blueprints";
import { EventTemplate } from "nostr-tools";
import z from "zod";

import server from "../server.js";
import { ownerFactory } from "../../owner.js";
import { rxNostr } from "../../rx-nostr.js";
import { requestLoader } from "../../loaders.js";
import config from "../../config.js";
import { lastValueFrom, toArray } from "rxjs";

server.tool(
  "Sign draft event",
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
  "Publish event",
  "Publishes an event to the owners outbox relays",
  {
    event: z.object({
      created_at: z.number(),
      content: z.string(),
      tags: z.array(z.array(z.string())),
      kind: z.number(),
      sig: z.string(),
      pubkey: z.string().length(64),
    }),
  },
  async ({ event }) => {
    if (!config.data.owner) throw new Error("Owner not set");
    const mailboxes = await requestLoader.mailboxes({ pubkey: config.data.owner });
    const results = await lastValueFrom(rxNostr.send(event, { on: { relays: mailboxes.outboxes } }).pipe(toArray()));

    return {
      content: results.map((result) => ({
        type: "text",
        text: `${result.from} ${result.ok ? "Success" : "Failed"}: ${result.message}`,
      })),
    };
  },
);

async function returnUnsigned(draft: EventTemplate | Promise<EventTemplate>): Promise<CallToolResult> {
  return {
    content: [{ type: "text", text: JSON.stringify(await ownerFactory.stamp(await draft)) }],
  };
}

server.tool(
  "Short text note draft",
  "Create a short text note draft event",
  {
    content: z.string(),
  },
  async ({ content }) => returnUnsigned(ownerFactory.create(NoteBlueprint, content)),
);
