import InboundNetworkManager from "../modules/network/inbound/index.js";
import OutboundNetworkManager from "../modules/network/outbound/index.js";
import { server } from "./server.js";

export const inboundNetwork = new InboundNetworkManager(server);
export const outboundNetwork = new OutboundNetworkManager();
