import { FollowUser, PinNote, UnfollowUser, UnpinNote } from "applesauce-actions/actions";
import { getProfilePointersFromList } from "applesauce-core/helpers";
import { markdownTable } from "markdown-table";
import { kinds } from "nostr-tools";
import z from "zod";

import bakeryConfig from "../../bakery-config.js";
import eventCache from "../../event-cache.js";
import { asyncLoader } from "../../loaders.js";
import { ownerActions, ownerPublish } from "../../owner-signer.js";
import { userInput } from "../inputs.js";
import mcpServer from "../server.js";

// Follow list
mcpServer.tool(
  "follow_user",
  "Adds another users pubkey to the following list",
  {
    user: userInput.describe("The user to follow"),
  },
  async ({ user }) => {
    try {
      await ownerActions.exec(FollowUser, user).forEach(ownerPublish);
      return { content: [{ type: "text", text: "Added user to following list" }] };
    } catch (error) {
      return { content: [{ type: "text", text: "Error following user" }] };
    }
  },
);

mcpServer.tool(
  "unfollow_user",
  "Removes another users pubkey from the following list",
  {
    user: userInput.describe("The user to unfollow"),
  },
  async ({ user }) => {
    try {
      await ownerActions.exec(UnfollowUser, user).forEach(ownerPublish);
      return { content: [{ type: "text", text: "Removed user from following list" }] };
    } catch (error) {
      return { content: [{ type: "text", text: "Error unfollowing user" }] };
    }
  },
);

mcpServer.tool("get_following_list", "Gets the following list", {}, async () => {
  if (!bakeryConfig.data.owner) throw new Error("Missing user pubkey");

  const contacts = eventCache.getReplaceable(kinds.Contacts, bakeryConfig.data.owner);
  if (!contacts) return { content: [{ type: "text", text: "No following list found" }] };

  const people = getProfilePointersFromList(contacts);

  const table: [string, string][] = [["Name", "Pubkey"]];
  await Promise.allSettled(
    people.map(async (p) => {
      const profile = await asyncLoader.profile(p.pubkey);
      table.push([profile?.name ?? "Unknown", p.pubkey]);
    }),
  );

  return { content: [{ type: "text", text: markdownTable(table) }] };
});

// Note pinning
mcpServer.tool(
  "pin_note",
  "Pins a kind 1 note to the pinned notes list",
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
  "Unpins a kind 1 note from the pinned notes list",
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
