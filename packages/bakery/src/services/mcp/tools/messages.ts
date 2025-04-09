import { mergeRelaySets } from "applesauce-core/helpers";
import { includeSingletonTag, setEncryptedContent } from "applesauce-factory/operations/event";
import { kinds } from "nostr-tools";
import { lastValueFrom, toArray } from "rxjs";
import { z } from "zod";

import { LOOKUP_RELAYS } from "../../../env.js";
import bakeryConfig from "../../bakery-config.js";
import { asyncLoader } from "../../loaders.js";
import { ownerAccount$, ownerFactory, ownerSigner } from "../../owner-signer.js";
import pool from "../../pool.js";
import mcpServer from "../server.js";
import { userInput } from "../inputs.js";

mcpServer.tool(
  "send_direct_message",
  "Send a encrypted direct message to a user",
  {
    user: userInput.describe("The user to send the message to"),
    message: z.string().describe("The message to send"),
  },
  async ({ user, message }) => {
    if (!ownerAccount$.value) return { content: [{ type: "text", text: "No nostr signer found" }] };

    // Create a new NIP-04 message
    const draft = await ownerFactory.build(
      {
        kind: kinds.EncryptedDirectMessage,
      },
      includeSingletonTag(["p", user]),
      setEncryptedContent(user, message, "nip04"),
    );

    // Sign the event
    const event = await ownerFactory.sign(draft);

    // Get users inboxes
    const otherInboxes = await asyncLoader.inboxes(user, bakeryConfig.data.lookup_relays ?? LOOKUP_RELAYS);
    if (otherInboxes.length === 0) {
      return {
        content: [{ type: "text", text: "The user has no DM inboxes configured" }],
      };
    }

    const ownerInboxes = await asyncLoader.inboxes(
      await ownerSigner.getPublicKey(),
      bakeryConfig.data.lookup_relays ?? LOOKUP_RELAYS,
    );

    // publish the event to the owner and the other user
    const results = await lastValueFrom(pool.event(mergeRelaySets(ownerInboxes, otherInboxes), event).pipe(toArray()));

    return {
      content: [
        { type: "text", text: `Message sent to ${results.length} relays` },
        { type: "text", text: results.map((r) => `${r.from} (${r.ok}) ${r.message ?? ""}`).join("\n") },
      ],
    };
  },
);
