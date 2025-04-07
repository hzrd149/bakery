import { firstValueFrom } from "rxjs";

import mcpServer from "../server.js";
import { connections$ } from "../../pool.js";

mcpServer.tool("get_relays_connection_status", "Gets the connection status of all the relays", {}, async () => {
  const relays = await firstValueFrom(connections$);

  return { content: [{ type: "text", text: JSON.stringify(relays) }] };
});
