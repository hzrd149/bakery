import { Query } from "../types.js";
import bakeryConfig, { BakeryConfig } from "../../../services/config.js";

export const ConfigQuery: Query<BakeryConfig> = () => bakeryConfig.data$;
