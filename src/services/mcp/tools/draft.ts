import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NoteBlueprint } from "applesauce-factory/blueprints";
import { EventTemplate } from "nostr-tools";
import { z } from "zod";

import server from "../server.js";
import { ownerFactory } from "../../owner.js";

async function returnUnsigned(draft: EventTemplate | Promise<EventTemplate>): Promise<CallToolResult> {
  return {
    content: [{ type: "text", text: JSON.stringify(await ownerFactory.stamp(await draft)) }],
  };
}

server.tool(
  "short_text_note_draft",
  "Create a short text note draft event",
  {
    content: z.string(),
  },
  async ({ content }) => returnUnsigned(ownerFactory.create(NoteBlueprint, content)),
);
