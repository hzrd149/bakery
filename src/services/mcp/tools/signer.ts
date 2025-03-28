import { NostrConnectSigner } from "applesauce-signers/signers/nostr-connect-signer";
import { NostrConnectAccount } from "applesauce-accounts/accounts/nostr-connect-account";
import { z } from "zod";

import server from "../server.js";
import { ownerAccount$, setupSigner$, startSignerSetup, stopSignerSetup } from "../../owner.js";
import { DEFAULT_NOSTR_CONNECT_RELAYS } from "../../../const.js";

const qrcode = require("qrcode-terminal");

server.tool(
  "connect_nostr_signer",
  "Connects remote signer using a bunker:// URI",
  { uri: z.string().startsWith("bunker://") },
  async ({ uri }) => {
    if (ownerAccount$.value) return { content: [{ type: "text", text: "The owner already has a signer connected" }] };

    const signer = await NostrConnectSigner.fromBunkerURI(uri, {});
    const pubkey = await signer.getPublicKey();
    const account = new NostrConnectAccount(pubkey, signer);
    ownerAccount$.next(account);

    return { content: [{ type: "text", text: "Connected to the signer" }] };
  },
);

server.tool("disconnect_nostr_signer", "Disconnects and forgets the current signer", {}, async () => {
  if (!ownerAccount$.value) return { content: [{ type: "text", text: "No signer connected" }] };
  ownerAccount$.next(undefined);

  return { content: [{ type: "text", text: "Disconnected from the signer" }] };
});

server.tool("nostr_signer_status", "Gets the status of the current signer", {}, async () => {
  const account = ownerAccount$.getValue();
  if (!account) return { content: [{ type: "text", text: "No signer connected" }] };

  if (setupSigner$.value) {
    return { content: [{ type: "text", text: "Signer setup in progress, waiting for the owner to connect" }] };
  }

  return {
    content: [
      {
        type: "text",
        text: [
          `Pubkey: ${await account.getPublicKey()}`,
          `Connected: ${account.signer.isConnected}`,
          `Relays: ${account.signer.relays.join(", ")}`,
        ].join("\n"),
      },
    ],
  };
});

// signer setup tools
server.tool(
  "create_signer_setup_link",
  "Creates a nostrconnect:// URI for the owner to setup their signer",
  { relays: z.array(z.string().url()).default(DEFAULT_NOSTR_CONNECT_RELAYS) },
  async ({ relays }) => {
    const account = ownerAccount$.getValue();
    if (account) return { content: [{ type: "text", text: "A signer is already connected" }] };

    // Create a new signer if there isn't one already
    if (!setupSigner$.value) startSignerSetup(relays);

    const uri = setupSigner$.value!.getNostrConnectURI();

    // Generate QR code
    const qr = await new Promise<string>((resolve) => {
      qrcode.generate(uri, { small: true }, (qr: string) => resolve(qr));
    });

    return {
      content: [
        { type: "text", text: qr },
        { type: "text", text: `Nostr Connect URI: ${uri}` },
      ],
    };
  },
);

server.tool("abort_nostr_signer_setup", "Aborts the signer setup process", {}, async () => {
  await stopSignerSetup();

  return { content: [{ type: "text", text: "signer setup aborted" }] };
});
