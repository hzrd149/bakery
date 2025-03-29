import { NostrConnectSigner } from "applesauce-signers/signers/nostr-connect-signer";
import { NostrConnectAccount } from "applesauce-accounts/accounts/nostr-connect-account";
import qrcode from "qrcode-terminal";
import { z } from "zod";

import mcpServer from "../server.js";
import { ownerAccount$, setupSigner$, startSignerSetup, stopSignerSetup } from "../../owner-signer.js";
import { DEFAULT_NOSTR_CONNECT_RELAYS } from "../../../const.js";
import { normalizeToHexPubkey } from "../../../helpers/nip19.js";
import bakeryConfig from "../../config.js";

mcpServer.prompt("setup_signer", "Start the setup and connection process for the users nostr signer", async () => {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Start the signer setup process and show the full ASCII qr code and nostr connect URI",
        },
      },
    ],
  };
});

mcpServer.tool(
  "set_owner_pubkey",
  "Sets the owner's pubkey",
  { pubkey: z.string().transform((p) => normalizeToHexPubkey(p, true)) },
  async ({ pubkey }) => {
    bakeryConfig.setField("owner", pubkey);
    return { content: [{ type: "text", text: "Owner pubkey set" }] };
  },
);

mcpServer.tool("get_owner_pubkey", "Gets the owner's pubkey", {}, async () => {
  const pubkey = bakeryConfig.data.owner;
  if (!pubkey) return { content: [{ type: "text", text: "No owner pubkey set" }] };

  return { content: [{ type: "text", text: pubkey }] };
});

mcpServer.tool("get_setup_status", "Checks if the bakery needs to be setup", {}, async () => {
  if (!bakeryConfig.data.owner)
    return { content: [{ type: "text", text: "Missing owner pubkey, please set an owner to finish bakery setup" }] };

  const account = ownerAccount$.getValue();
  if (!account)
    return { content: [{ type: "text", text: "No signer connected, setup a signer if you want to sign events" }] };

  if (setupSigner$.value)
    return { content: [{ type: "text", text: "Signer setup in progress, waiting for the owner to connect" }] };

  return { content: [{ type: "text", text: "Bakery is ready to use" }] };
});

// connect remote signer tools
mcpServer.tool(
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

mcpServer.tool("disconnect_nostr_signer", "Disconnects and forgets the current signer", {}, async () => {
  if (!ownerAccount$.value) return { content: [{ type: "text", text: "No signer connected" }] };
  ownerAccount$.next(undefined);

  return { content: [{ type: "text", text: "Disconnected from the signer" }] };
});

// signer setup tools
mcpServer.tool(
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
        { type: "text", text: "Started signer setup, scan the QR code or connect manually with the URI" },
        { type: "text", text: `Scan this QR Code to connect a signer\n${qr}` },
        { type: "text", text: `or manually connect to: ${uri}` },
      ],
    };
  },
);

// get signer status tools
mcpServer.tool("nostr_signer_status", "Gets the status of the current signer", {}, async () => {
  const account = ownerAccount$.getValue();
  if (!account) return { content: [{ type: "text", text: "No signer connected" }] };

  if (setupSigner$.value) {
    const uri = setupSigner$.value!.getNostrConnectURI();

    // Generate QR code
    const qr = await new Promise<string>((resolve) => {
      qrcode.generate(uri, { small: true }, (qr: string) => resolve(qr));
    });

    return {
      content: [
        { type: "text", text: "Signer setup in progress, waiting for the signer to connect" },
        { type: "text", text: `Scan this QR Code to connect a signer\n${qr}` },
        { type: "text", text: `or manually connect to: ${uri}` },
      ],
    };
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

mcpServer.tool("abort_nostr_signer_setup", "Aborts the signer setup process", {}, async () => {
  await stopSignerSetup();

  return { content: [{ type: "text", text: "signer setup aborted" }] };
});
