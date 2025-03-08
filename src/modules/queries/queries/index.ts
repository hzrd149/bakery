import QueryManager from "../manager.js";
import { ConfigQuery } from "./config.js";
import { LogsQuery } from "./logs.js";
import NetworkStateQuery from "./network-status.js";
import { ServicesQuery } from "./services.js";

QueryManager.types.set("network-status", NetworkStateQuery);
QueryManager.types.set("logs", LogsQuery);
QueryManager.types.set("services", ServicesQuery);
QueryManager.types.set("config", ConfigQuery);
