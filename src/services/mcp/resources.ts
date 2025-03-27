import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import server from "./server.js";
import config from "../config.js";
import { normalizeToHexPubkey } from "../../helpers/nip19.js";
import { requestLoader } from "../loaders.js";

server.resource("owner pubkey", "pubkey://owner", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: config.data.owner ?? "undefined",
    },
  ],
}));

server.resource("config", "config://app", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(config.data, null, 2),
    },
  ],
}));

server.resource(
  "user profile",
  new ResourceTemplate("users://{pubkey}/profile", { list: undefined }),
  async (uri, { pubkey }) => {
    if (typeof pubkey !== "string") throw new Error("Pubkey must be a string");

    pubkey = normalizeToHexPubkey(pubkey, true);
    const profile = await requestLoader.profile({ pubkey });

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  },
);
