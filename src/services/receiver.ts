import { filter, map } from "rxjs";

import bakeryConfig from "./bakery-config.js";
import { asyncLoader } from "./loaders.js";
import { rxNostr } from "./rx-nostr.js";
import Receiver from "../modules/receiver/index.js";
import stateManager from "./app-state.js";

const root = bakeryConfig.data$.pipe(
  map((c) => c.owner),
  filter((p) => p !== undefined),
);

const receiver = new Receiver(root, asyncLoader, rxNostr, {
  refreshInterval: 60_000,
  minRelaysPerPubkey: 1,
  maxRelaysPerPubkey: 3,
});
receiver.state = stateManager.getMutableState("receiver", {});

export default receiver;
