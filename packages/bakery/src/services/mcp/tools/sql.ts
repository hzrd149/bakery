import { z } from "zod";

import mcpServer from "../server.js";
import bakeryDatabase from "../../../db/index.js";

mcpServer.tool(
  "sqlite_read_query",
  "Run a SELECT query on the sqlite database",
  {
    sql: z.string().startsWith("SELECT"),
  },
  async ({ sql }) => {
    const results = await bakeryDatabase.all(sql);

    return {
      content: results.map((r) => ({
        type: "text",
        text: JSON.stringify(r),
      })),
    };
  },
);

mcpServer.tool("sqlite_list_tables", "List all the tables in the sqlite database", {}, async () => {
  const tables = await bakeryDatabase.all<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' AND name NOT LIKE '%_fts%';",
  );

  return {
    content: tables.map((t) => ({
      type: "text",
      text: t.name + "\n" + t.sql,
    })),
  };
});
