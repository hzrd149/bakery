import { Observable } from "rxjs";

import { Query } from "../types.js";
import bakeryConfig, { BakeryConfig } from "../../../services/config.js";

export const ConfigQuery: Query<BakeryConfig> = () =>
  new Observable((observer) => {
    observer.next(bakeryConfig.data);
    const listener = (c: BakeryConfig) => observer.next(c);
    bakeryConfig.on("updated", listener);
    return () => bakeryConfig.off("updated", listener);
  });
