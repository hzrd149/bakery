import { TBakeryConfig } from "bakery-common";

import ActionManager from "../modules/actions/manager.js";
import bakeryConfig from "./bakery-config.js";

ActionManager.registerAction("config-update", async (update) => {
  for (const [key, value] of Object.entries(update)) {
    bakeryConfig.setField(key as keyof TBakeryConfig, value);
  }

  return void 0;
});
