import { getPubkeyFromDecodeResult, isHex, isHexKey } from "applesauce-core/helpers";
import { nip19 } from "nostr-tools";
import { z } from "zod";

import eventCache from "../event-cache.js";
import { asyncLoader, dnsIdentityLoader } from "../loaders.js";

export const eventInput = z
  .union([
    z.string().length(64),
    z.string().startsWith("note1"),
    z.string().startsWith("nevent1"),
    z.string().startsWith("naddr1"),
    z.object({
      id: z.string(),
    }),
  ])
  .transform(async (input) => {
    if (typeof input === "string") {
      // get the event based on the id in the string
      if (isHexKey(input)) return eventCache.getEventsForFilters([{ ids: [input] }])[0];

      try {
        const decode = nip19.decode(input);

        switch (decode.type) {
          case "note":
            return asyncLoader.event(decode.data);
          case "nevent":
            return asyncLoader.event(decode.data.id, decode.data.relays);
          case "naddr":
            return asyncLoader.replaceable(decode.data.kind, decode.data.pubkey, decode.data.identifier);
        }
      } catch (error) {}
    } else if (typeof input === "object") {
      // get the event based on the id in the object
      return eventCache.getEventsForFilters([{ ids: [input.id] }])[0];
    }

    throw new Error("Invalid event input");
  });

export const userInput = z
  .union([
    z.string().length(64).describe("hex pubkey"),
    z.string().startsWith("npu1").describe("nostr npub"),
    z.string().startsWith("nprofile").describe("nostr nprofile"),
    z.string().includes("@").describe("nostr NIP-05"),
    z.string().describe("username"),
  ])
  .transform(async (input): Promise<string> => {
    if (isHexKey(input)) return input;

    // nip-19
    if (input.startsWith("npub") || input.startsWith("nprofile")) {
      const decode = nip19.decode(input);
      const pubkey = getPubkeyFromDecodeResult(decode);
      if (!pubkey) throw new Error(`Failed to get pubkey from NIP-19 ${decode.type}`);
      return pubkey;
    }

    // nip-05
    if (input.includes("@")) {
      const [name, domain] = input.split("@");
      const identity = await dnsIdentityLoader.loadIdentity(name, domain);
      if (identity.status === "error") throw new Error("Invalid NIP-05");
      if (identity.status === "missing") throw new Error("Missing NIP-05");
      return identity.pubkey;
    }

    // username
    throw new Error("Usernames are not supported yet");
  });
