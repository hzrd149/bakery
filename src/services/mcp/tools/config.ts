import { z } from "zod";

import server from "../server.js";
import { ownerAccount$ } from "../../owner.js";
import { NostrConnectSigner } from "applesauce-signers";
import { NostrConnectAccount } from "applesauce-accounts/accounts";
import { normalizeToHexPubkey } from "../../../helpers/nip19.js";
import config from "../../config.js";

server.tool(
  "set_owner_nostr_connect_uri",
  "Sets the nostr connect URI that should be used to request signatures from the owners pubkey",
  { uri: z.string().startsWith("bunker://") },
  async ({ uri }) => {
    try {
      const signer = await NostrConnectSigner.fromBunkerURI(uri, {});
      const pubkey = await signer.getPublicKey();
      const account = new NostrConnectAccount(pubkey, signer);
      ownerAccount$.next(account);

      return { content: [{ type: "text", text: "Connected to the nostr signer" }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: "Error connecting to the nostr signer: " + error.message }] };
    }
  },
);

server.tool(
  "set_owner_pubkey",
  "Sets the owner of the bakery",
  { pubkey: z.string().transform((hex) => normalizeToHexPubkey(hex, true)) },
  async ({ pubkey }) => {
    config.setField("owner", pubkey);

    return { content: [{ type: "text", text: "Owner set" }] };
  },
);
