import z from "zod";
import server from "../server.js";
import { ownerActions, ownerPublish } from "../../owner.js";
import { FollowUser, UnfollowUser } from "applesauce-actions/actions";
import { normalizeToHexPubkey } from "../../../helpers/nip19.js";

server.tool(
  "Follow user",
  "Adds another users pubkey to the owners following list",
  { pubkey: z.string().transform((hex) => normalizeToHexPubkey(hex, true)) },
  async ({ pubkey }) => {
    try {
      await ownerActions.exec(FollowUser, pubkey).forEach(ownerPublish);
      return { content: [{ type: "text", text: "Added user to following list" }] };
    } catch (error) {
      return { content: [{ type: "text", text: "Error following user" }] };
    }
  },
);

server.tool(
  "Unfollow user",
  "Removes another users pubkey from the owners following list",
  { pubkey: z.string().transform((hex) => normalizeToHexPubkey(hex, true)) },
  async ({ pubkey }) => {
    try {
      await ownerActions.exec(UnfollowUser, pubkey).forEach(ownerPublish);
      return { content: [{ type: "text", text: "Removed user from following list" }] };
    } catch (error) {
      return { content: [{ type: "text", text: "Error unfollowing user" }] };
    }
  },
);
