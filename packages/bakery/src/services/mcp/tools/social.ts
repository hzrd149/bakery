import { OkPacketAgainstEvent } from "rx-nostr";
import { CommentBlueprint, NoteBlueprint, NoteReplyBlueprint, ReactionBlueprint } from "applesauce-factory/blueprints";
import { z } from "zod";

import mcpServer from "../server.js";
import { ownerFactory, ownerPublish } from "../../owner-signer.js";
import { eventInput } from "../inputs.js";

function publishFeedback(results: OkPacketAgainstEvent[]) {
  return [
    "Relays:",
    results.map((r) => `${r.from} ${r.ok ? "success" : "failed"} ${r.notice}`).join("\n"),
    "Total: " + results.length,
  ].join("\n");
}

mcpServer.tool(
  "publish_short_text_note",
  "Publishes a kind 1 short text note",
  {
    content: z.string(),
  },
  async ({ content }) => {
    const draft = await ownerFactory.create(NoteBlueprint, content);
    const signed = await ownerFactory.sign(draft);
    const results = await ownerPublish(signed);

    return {
      content: [
        { type: "text", text: `Published note event ${signed.id}` },
        { type: "text", text: publishFeedback(results) },
      ],
    };
  },
);

mcpServer.tool(
  "reply_to_text_note",
  "Publishes a reply to a text note",
  {
    event: eventInput.describe("The event to reply to"),
    content: z.string(),
  },
  async ({ content, event }) => {
    const reply = await ownerFactory.create(NoteReplyBlueprint, event, content);
    const signed = await ownerFactory.sign(reply);
    const results = await ownerPublish(signed);

    return {
      content: [
        { type: "text", text: `Published reply event ${signed.id}` },
        { type: "text", text: publishFeedback(results) },
      ],
    };
  },
);

mcpServer.tool(
  "add_reaction_to_event",
  "Adds a reaction to a nostr event",
  {
    event: eventInput.describe("The event to react to"),
    emoji: z.union([z.literal("+"), z.literal("-"), z.string().emoji()]).describe("The emoji to react with"),
  },
  async ({ event, emoji }) => {
    const reaction = await ownerFactory.create(ReactionBlueprint, event, emoji);
    const signed = await ownerFactory.sign(reaction);
    const results = await ownerPublish(signed);

    return {
      content: [
        { type: "text", text: `Published reaction event ${signed.id}` },
        { type: "text", text: publishFeedback(results) },
      ],
    };
  },
);

mcpServer.tool(
  "comment_on_event",
  "Publishes a comment on an event or replies to an existing comment event",
  {
    event: eventInput.describe("The event to comment on"),
    content: z.string(),
  },
  async ({ content, event }) => {
    const comment = await ownerFactory.create(CommentBlueprint, event, content);
    const signed = await ownerFactory.sign(comment);
    const results = await ownerPublish(signed);

    return {
      content: [
        { type: "text", text: `Published comment event ${signed.id}` },
        { type: "text", text: publishFeedback(results) },
      ],
    };
  },
);
