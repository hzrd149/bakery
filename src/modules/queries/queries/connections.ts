import { ConnectionState } from "rx-nostr";

import { Query } from "../types.js";
import { connections$ } from "../../../services/rx-nostr.js";

export const ConnectionsQuery: Query<Record<string, ConnectionState>> = () => {
  return connections$;
};
