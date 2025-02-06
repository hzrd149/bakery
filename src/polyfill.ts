import { useWebSocketImplementation } from "nostr-tools/relay";
import OutboundProxyWebSocket from "./modules/network/outbound/websocket.js";

// @ts-expect-error
global.WebSocket = OutboundProxyWebSocket;
useWebSocketImplementation(OutboundProxyWebSocket);
