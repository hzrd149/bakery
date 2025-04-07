import { normalizeURL } from "applesauce-core/helpers";
import { EncryptedDirectMessage } from "nostr-tools/kinds";

export const DEFAULT_PORT = 9272;
export const SENSITIVE_KINDS = [EncryptedDirectMessage];

export const NIP_11_SOFTWARE_URL = "git+https://github.com/hzrd149/bakery.git";

export const OUTBOUND_PROXY_TYPES = ["SOCKS5", "HTTP"];

export const DEFAULT_FALLBACK_RELAYS = ["wss://nos.lol", "wss://relay.damus.io", "wss://relay.nostr.band"].map(
  normalizeURL,
);
export const DEFAULT_LOOKUP_RELAYS = ["wss://purplepag.es/", "wss://user.kindpag.es/"].map(normalizeURL);
export const DEFAULT_NOSTR_CONNECT_RELAYS = ["wss://relay.nsec.app/"].map(normalizeURL);
