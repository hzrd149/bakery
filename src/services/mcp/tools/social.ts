import { OkPacketAgainstEvent } from "rx-nostr";
import { CommentBlueprint, NoteBlueprint, NoteReplyBlueprint, ReactionBlueprint } from "applesauce-factory/blueprints";
import { nip19, NostrEvent } from "nostr-tools";
import { lastValueFrom } from "rxjs";
import { isHex } from "applesauce-core/helpers";
import { simpleTimeout } from "applesauce-core/observable";
import { z } from "zod";

import mcpServer from "../server.js";
import { ownerFactory, ownerPublish } from "../../owner-signer.js";
import eventCache from "../../event-cache.js";
import { asyncLoader, singleEventLoader } from "../../loaders.js";
import { eventStore } from "../../stores.js";

function publishFeedback(results: OkPacketAgainstEvent[]) {
  return [
    "Relays:",
    results.map((r) => `${r.from} ${r.ok ? "success" : "failed"} ${r.notice}`).join("\n"),
    "Total: " + results.length,
  ].join("\n");
}

async function resolveEventInput(input: string | { id: string }): Promise<NostrEvent | undefined> {
  if (typeof input === "string") {
    // get the event based on the id in the string
    if (isHex(input)) return eventCache.getEventsForFilters([{ ids: [input] }])[0];
    else if (input.startsWith("nevent")) {
      const decode = nip19.decode(input);
      if (decode.type !== "nevent") throw new Error("Invalid event id");
      let event = eventCache.getEventsForFilters([{ ids: [decode.data.id] }])[0];

      if (event) return event;

      // try to load the event from the loader
      singleEventLoader.next(decode.data);
      return await lastValueFrom(
        eventStore.event(decode.data.id).pipe(simpleTimeout<NostrEvent | undefined>(10_000, "Failed to find event")),
      );
    } else if (input.startsWith("naddr")) {
      const decode = nip19.decode(input);
      if (decode.type !== "naddr") throw new Error("Invalid event address");

      let event = eventCache.getEventsForFilters([
        { kinds: [decode.data.kind], authors: [decode.data.pubkey], "#d": [decode.data.identifier] },
      ])[0];

      if (event) return event;

      // try to load the event from the replaceable loader
      return await asyncLoader.replaceable(decode.data.kind, decode.data.pubkey, decode.data.identifier);
    }
  } else {
    // get the event based on the id in the object
    return eventCache.getEventsForFilters([{ ids: [input.id] }])[0];
  }
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
    event: z.union([z.string(), z.object({ id: z.string() })]).describe("The event to reply to"),
    content: z.string(),
  },
  async ({ content, event: eventId }) => {
    let event = await resolveEventInput(eventId);
    if (!event) throw new Error("Event not found");

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
  "Publishes a new reaction to an event",
  {
    event: z.union([z.string(), z.object({ id: z.string() })]).describe("The event to react to"),
    emoji: z.union([z.literal("+"), z.literal("-"), z.string().emoji()]).describe("The emoji to react with"),
  },
  async ({ event: eventId, emoji }) => {
    let event = await resolveEventInput(eventId);
    if (!event) throw new Error("Event not found");

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
    event: z.union([z.string(), z.object({ id: z.string() })]).describe("The event to comment on"),
    content: z.string(),
  },
  async ({ content, event: eventId }) => {
    let event = await resolveEventInput(eventId);
    if (!event) throw new Error("Event not found");

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
