import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import server from "./server.js";
import bakeryConfig from "../config.js";
import { normalizeToHexPubkey } from "../../helpers/nip19.js";
import { requestLoader } from "../loaders.js";
import { kinds } from "nostr-tools";

server.resource("owner_pubkey", "pubkey://owner", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: bakeryConfig.data.owner ?? "undefined",
    },
  ],
}));

server.resource("config", "config://app", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(bakeryConfig.data),
    },
  ],
}));

server.resource(
  "user_profile",
  new ResourceTemplate("users://{pubkey}/profile", { list: undefined }),
  async (uri, { pubkey }) => {
    if (typeof pubkey !== "string") throw new Error("Pubkey must be a string");

    pubkey = normalizeToHexPubkey(pubkey, true);
    const profile = await requestLoader.profile({ pubkey });

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(profile),
        },
      ],
    };
  },
);

server.resource("event_kinds", "nostr://kinds", async (uri) => {
  return {
    contents: [{ uri: uri.href, text: JSON.stringify(kinds) }],
  };
});
