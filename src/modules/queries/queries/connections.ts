import { ConnectionState } from "rx-nostr";

import { Query } from "../types.js";
import { connections$ } from "../../../services/rx-nostr.js";

const ConnectionsQuery: Query<Record<string, ConnectionState>> = () => connections$;

export default ConnectionsQuery;
