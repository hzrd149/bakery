import { MuteUser, UnmuteUser } from "applesauce-actions/actions";
import { getHiddenMutedThings, getMutedThings, Mutes, unlockHiddenTags } from "applesauce-core/helpers";
import { markdownTable } from "markdown-table";
import { kinds } from "nostr-tools";
import { z } from "zod";

import bakeryConfig from "../../bakery-config.js";
import eventCache from "../../event-cache.js";
import { asyncLoader } from "../../loaders.js";
import { ownerActions, ownerPublish, ownerSigner } from "../../owner-signer.js";
import { pubkeyInput } from "../common.js";
import mcpServer from "../server.js";

mcpServer.tool(
  "mute_user",
  "Add a users pubkey to the mute list",
  {
    pubkey: pubkeyInput.describe("The pubkey of the user to mute"),
    hidden: z.boolean().default(false).describe("Whether to publicly mute the user to privately"),
  },
  async ({ pubkey }) => {
    await ownerActions.exec(MuteUser, pubkey).forEach(ownerPublish);
    return { content: [{ type: "text", text: "Added user to mute list" }] };
  },
);
mcpServer.tool(
  "unmute_user",
  "Remove a users pubkey from the mute list",
  {
    pubkey: pubkeyInput.describe("The pubkey of the user to unmute"),
    hidden: z.boolean().default(false).describe("Whether to publicly unmute the user or privately"),
  },
  async ({ pubkey }) => {
    await ownerActions.exec(UnmuteUser, pubkey).forEach(ownerPublish);
    return { content: [{ type: "text", text: "Removed user from mute list" }] };
  },
);
mcpServer.tool("get_muted_list", "Gets the muted list", {}, async () => {
  if (!bakeryConfig.data.owner) throw new Error("Missing user pubkey");

  const muteList = eventCache.getReplaceable(kinds.Mutelist, bakeryConfig.data.owner);
  if (!muteList) return { content: [{ type: "text", text: "No mute list found" }] };

  const mutes = getMutedThings(muteList);
  let hidden: Mutes | undefined = undefined;

  if (ownerSigner) {
    await unlockHiddenTags(muteList, ownerSigner);
    hidden = getHiddenMutedThings(muteList);
  }

  const table: [string, string, string][] = [["Name", "Pubkey", "Hidden"]];
  await Promise.allSettled(
    Array.from(mutes.pubkeys).map(async (pubkey) => {
      const profile = await asyncLoader.profile(pubkey);
      table.push([profile?.name ?? "Unknown", pubkey, hidden?.pubkeys.has(pubkey) ? "Yes" : "No"]);
    }),
  );

  return { content: [{ type: "text", text: markdownTable(table) }] };
});
