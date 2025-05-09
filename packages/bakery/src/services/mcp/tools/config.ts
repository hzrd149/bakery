import { z } from "zod";

import mcpServer from "../server.js";
import bakeryConfig from "../../bakery-config.js";

mcpServer.tool("get_bakery_config", "Gets the current configuration for the bakery", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify(bakeryConfig.data) }] };
});

mcpServer.tool(
  "update_bakery_config",
  "Updates the bakery config with the provided config",
  { config: z.record(z.unknown()).describe("A partial config to update") },
  async ({ config }) => {
    bakeryConfig.update((data) => {
      return { ...data, ...config };
    });

    return { content: [{ type: "text", text: "Updated config" }] };
  },
);
