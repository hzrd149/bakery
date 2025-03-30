import { kinds } from "nostr-tools";

import mcpServer from "./server.js";
import bakeryConfig from "../bakery-config.js";

mcpServer.resource("owner_pubkey", "pubkey://owner", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: bakeryConfig.data.owner ?? "undefined",
    },
  ],
}));

mcpServer.resource("config", "config://app", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(bakeryConfig.data),
    },
  ],
}));

mcpServer.resource("event_kinds", "nostr://kinds", async (uri) => {
  return {
    contents: [{ uri: uri.href, text: JSON.stringify(kinds) }],
  };
});
