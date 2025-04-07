import { z } from "zod";
import { normalizeToHexPubkey } from "../../helpers/nip19.js";

export const pubkeyInput = z.string().transform((hex) => normalizeToHexPubkey(hex, true));
