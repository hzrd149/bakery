import database from "../../database.js";
import server from "../server.js";

server.tool("Total events", "Get the total number of events in the database", {}, async () => {
  const result = database.db.prepare<[], { events: number }>(`SELECT COUNT(*) AS events FROM events`).get();
  return { content: [{ type: "text", text: `Total events: ${result?.events ?? 0}` }] };
});

server.tool("Total users", "Get the total number of users in the database", {}, async () => {
  const result = database.db
    .prepare<[], { users: number }>(`SELECT COUNT(*) AS users FROM events GROUP BY pubkey`)
    .get();
  return { content: [{ type: "text", text: `Total users: ${result?.users ?? 0}` }] };
});
