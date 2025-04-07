import { count } from "drizzle-orm";

import mcpServer from "../server.js";
import bakeryDatabase, { schema } from "../../../db/index.js";

mcpServer.tool("get_database_stats", "Get the total number of events in the database", {}, async () => {
  const events = await bakeryDatabase.$count(schema.events);
  const { users } =
    bakeryDatabase.select({ users: count() }).from(schema.events).groupBy(schema.events.pubkey).get() || {};

  return {
    content: [{ type: "text", text: [`Total events: ${events}`, `Total users: ${users ?? 0}`].join("\n") }],
  };
});
