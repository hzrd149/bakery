import z from "zod";
import { FollowUser, PinNote, UnfollowUser, UnpinNote } from "applesauce-actions/actions";

import mcpServer from "../server.js";
import { ownerActions, ownerPublish } from "../../owner-signer.js";
import { normalizeToHexPubkey } from "../../../helpers/nip19.js";
import eventCache from "../../event-cache.js";

mcpServer.tool(
  "follow_user",
  "Adds another users pubkey to the owners following list",
  {
    pubkey: z
      .string()
      .transform((hex) => normalizeToHexPubkey(hex, true))
      .describe("The pubkey of the user to follow"),
  },
  async ({ pubkey }) => {
    try {
      await ownerActions.exec(FollowUser, pubkey).forEach(ownerPublish);
      return { content: [{ type: "text", text: "Added user to following list" }] };
    } catch (error) {
      return { content: [{ type: "text", text: "Error following user" }] };
    }
  },
);

mcpServer.tool(
  "unfollow_user",
  "Removes another users pubkey from the owners following list",
  {
    pubkey: z
      .string()
      .transform((hex) => normalizeToHexPubkey(hex, true))
      .describe("The pubkey of the user to unfollow"),
  },
  async ({ pubkey }) => {
    try {
      await ownerActions.exec(UnfollowUser, pubkey).forEach(ownerPublish);
      return { content: [{ type: "text", text: "Removed user from following list" }] };
    } catch (error) {
      return { content: [{ type: "text", text: "Error unfollowing user" }] };
    }
  },
);

mcpServer.tool(
  "pin_note",
  "Pins a kind 1 note to the owners pinned notes list",
  {
    id: z.string().describe("The event id of the note to pin"),
  },
  async ({ id }) => {
    const event = (await eventCache.getEventsForFilters([{ ids: [id] }]))[0];
    if (!event) throw new Error("Cant find note with id: " + id);

    await ownerActions.exec(PinNote, event).forEach(ownerPublish);
    return { content: [{ type: "text", text: "Pinned note" }] };
  },
);

mcpServer.tool(
  "unpin_note",
  "Unpins a kind 1 note from the owners pinned notes list",
  {
    id: z.string().describe("The event id of the note to unpin"),
  },
  async ({ id }) => {
    const event = (await eventCache.getEventsForFilters([{ ids: [id] }]))[0];
    if (!event) throw new Error("Cant find note with id: " + id);

    await ownerActions.exec(UnpinNote, event).forEach(ownerPublish);
    return { content: [{ type: "text", text: "Unpinned note" }] };
  },
);
