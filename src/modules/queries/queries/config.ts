import { Query } from "../types.js";
import bakeryConfig, { BakeryConfig } from "../../../services/bakery-config.js";

const ConfigQuery: Query<BakeryConfig> = () => bakeryConfig.data$;

export default ConfigQuery;
