import { z } from "zod";
import { ZBakeryConfig } from "./bakery-config.js";

// Create a map of action schemas (0 = input, 1 = output)
export const ZBakeryActions = {
  "config-update": [ZBakeryConfig.partial(), z.undefined()],
} as const;

// Export types
export type TBakeryActions = {
  [k in keyof typeof ZBakeryActions]: [z.infer<(typeof ZBakeryActions)[k][0]>, z.infer<(typeof ZBakeryActions)[k][1]>];
};
