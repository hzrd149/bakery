import QueryManager from "../manager.js";
import ConfigQuery from "./config.js";
import ConnectionsQuery from "./connections.js";
import { LogsQuery, ServicesQuery } from "./logs.js";
import NetworkStateQuery from "./network-status.js";
import { ReceiverConnectionMapQuery, ReceiverStatsQuery } from "./receiver.js";

QueryManager.types.set("network-status", NetworkStateQuery);
QueryManager.types.set("logs", LogsQuery);
QueryManager.types.set("services", ServicesQuery);
QueryManager.types.set("config", ConfigQuery);
QueryManager.types.set("connections", ConnectionsQuery);
QueryManager.types.set("receiver-stats", ReceiverStatsQuery);
QueryManager.types.set("receiver-connections", ReceiverConnectionMapQuery);
