import { Observable } from "rxjs";
import { PrivateNodeConfig } from "@satellite-earth/core/types";

import { Query } from "../types.js";
import config from "../../../services/config.js";

export const ConfigQuery: Query<PrivateNodeConfig> = () =>
  new Observable((observer) => {
    observer.next(config.data);
    const listener = (c: PrivateNodeConfig) => observer.next(c);
    config.on("updated", listener);
    return () => config.off("updated", listener);
  });
