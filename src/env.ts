import "dotenv/config.js";
import { OUTBOUND_PROXY_TYPES } from "./const.js";

import { safeRelayUrls } from "applesauce-core/helpers";
import { normalizeToHexPubkey } from "./helpers/nip19.js";

export const OWNER_PUBKEY = process.env.OWNER_PUBKEY ? normalizeToHexPubkey(process.env.OWNER_PUBKEY) : undefined;
export const PUBLIC_ADDRESS = process.env.PUBLIC_ADDRESS;
export const DATA_PATH = process.env.DATA_PATH || "./data";
export const PORT = parseInt(process.env.PORT ?? "") || 3000;

// I2P config
export const I2P_PROXY = process.env.I2P_PROXY;
export const I2P_PROXY_TYPE = (process.env.I2P_PROXY_TYPE || "SOCKS5") as "SOCKS5" | "HTTP";
export const I2P_SAM_ADDRESS = process.env.I2P_SAM_ADDRESS;

if (!OUTBOUND_PROXY_TYPES.includes(I2P_PROXY_TYPE)) throw new Error("Invalid I2P_PROXY_TYPE, must be SOCKS5 or HTTP");

// Tor config
export const TOR_PROXY = process.env.TOR_PROXY;
export const TOR_PROXY_TYPE = (process.env.TOR_PROXY_TYPE || "SOCKS5") as "SOCKS5" | "HTTP";
export const TOR_ADDRESS = process.env.TOR_ADDRESS;

if (!OUTBOUND_PROXY_TYPES.includes(TOR_PROXY_TYPE)) throw new Error("Invalid TOR_PROXY_TYPE, must be SOCKS5 or HTTP");

// Default relay config
export const BOOTSTRAP_RELAYS = process.env.BOOTSTRAP_RELAYS
  ? safeRelayUrls(process.env.BOOTSTRAP_RELAYS.split(","))
  : safeRelayUrls(["wss://nos.lol", "wss://relay.damus.io", "wss://relay.nostr.band"]);

export const COMMON_CONTACT_RELAYS = process.env.COMMON_CONTACT_RELAYS
  ? safeRelayUrls(process.env.COMMON_CONTACT_RELAYS.split(","))
  : safeRelayUrls(["wss://purplepag.es", "wss://user.kindpag.es", "wss://relay.nos.social"]);
