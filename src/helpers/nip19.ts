import { getPubkeyFromDecodeResult, isHexKey } from "applesauce-core/helpers";
import { nip19 } from "nostr-tools";

export function normalizeToHexPubkey(hex: string) {
  if (isHexKey(hex)) return hex;
  try {
    const decode = nip19.decode(hex);
    return getPubkeyFromDecodeResult(decode) ?? null;
  } catch (error) {
    return null;
  }
}
