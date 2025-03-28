import server from "../server.js";
import bakeryConfig, { bakeryConfigSchema } from "../../config.js";

server.tool("get_bakery_config", "Gets the current configuration for the bakery", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify(bakeryConfig.data) }] };
});

server.tool<typeof bakeryConfigSchema.shape>(
  "update_bakery_config",
  "Updates the bakery config with the provided config",
  // @ts-expect-error
  bakeryConfigSchema.partial(),
  async (config) => {
    bakeryConfig.update((data) => {
      return { ...data, ...config };
    });

    return { content: [{ type: "text", text: "Updated config" }] };
  },
);
