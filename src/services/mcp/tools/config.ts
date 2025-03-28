import mcpServer from "../server.js";
import bakeryConfig, { bakeryConfigSchema } from "../../config.js";

mcpServer.tool("get_bakery_config", "Gets the current configuration for the bakery", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify(bakeryConfig.data) }] };
});

mcpServer.tool(
  "update_bakery_config",
  "Updates the bakery config with the provided config",
  { config: bakeryConfigSchema.partial().describe("A partial config to update") },
  async ({ config }) => {
    bakeryConfig.update((data) => {
      return { ...data, ...config };
    });

    return { content: [{ type: "text", text: "Updated config" }] };
  },
);
