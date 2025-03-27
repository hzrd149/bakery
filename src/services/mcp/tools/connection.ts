import { firstValueFrom } from "rxjs";
import { isSameURL } from "applesauce-core/helpers";
import { z } from "zod";

import server from "../server.js";
import { connections$, notices$ } from "../../rx-nostr.js";

server.tool("get_connected_relays", "Gets the connection status of all the relays", {}, async () => {
  const relays = await firstValueFrom(connections$);

  return { content: [{ type: "text", text: JSON.stringify(relays) }] };
});

server.tool(
  "get_relay_notices",
  "Gets the notices from the all relays or a certain relay",
  { relay: z.string().url().optional() },
  async ({ relay }) => {
    let notices = await firstValueFrom(notices$);
    if (relay) notices = notices.filter((notice) => isSameURL(notice.from, relay));

    return {
      content: notices.map((notice) => ({ type: "text", text: `${notice.from} ${notice.message}` })),
    };
  },
);
