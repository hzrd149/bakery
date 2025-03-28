import { getPubkeyFromDecodeResult, isHexKey } from "applesauce-core/helpers";
import { nip19 } from "nostr-tools";

export function normalizeToHexPubkey(hex: string, require?: boolean): string | null;
export function normalizeToHexPubkey(hex: string, require: true): string;
export function normalizeToHexPubkey(hex: string, require = false): string | null {
  if (isHexKey(hex)) return hex;
  try {
    const decode = nip19.decode(hex);
    return getPubkeyFromDecodeResult(decode) ?? null;
  } catch (error) {
    if (require) throw error;
    else return null;
  }
}

export function normalizeToEventId(str: string, require?: boolean): string | null;
export function normalizeToEventId(str: string, require: true): string;
export function normalizeToEventId(str: string, require = false): string | null {
  try {
    const decode = nip19.decode(str);
    switch (decode.type) {
      case "note":
        return decode.data;
      case "nevent":
        return decode.data.id;
      default:
        throw new Error(`Cant get event id from ${decode.type}`);
    }
  } catch (error) {
    if (require) throw error;
    else return null;
  }
}
