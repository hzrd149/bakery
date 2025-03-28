import database from "../../database.js";
import mcpServer from "../server.js";

mcpServer.tool("get_database_stats", "Get the total number of events in the database", {}, async () => {
  const { events } = database.db.prepare<[], { events: number }>(`SELECT COUNT(*) AS events FROM events`).get() || {};
  const { users } =
    database.db.prepare<[], { users: number }>(`SELECT COUNT(*) AS users FROM events GROUP BY pubkey`).get() || {};

  return {
    content: [{ type: "text", text: [`Total events: ${events ?? 0}`, `Total users: ${users ?? 0}`].join("\n") }],
  };
});
