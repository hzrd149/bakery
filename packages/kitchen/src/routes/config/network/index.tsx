import HyperNetworkStatus from "./hyper";
import TorNetworkStatus from "./tor";
import I2PNetworkStatus from "./i2p";
import GossipSettings from "./gossip";

export default function NetworkConfigView() {
  return (
    <div class="flex flex-col gap-4">
      <HyperNetworkStatus />
      <div class="divider"></div>
      <TorNetworkStatus />
      <div class="divider"></div>
      <I2PNetworkStatus />
      <div class="divider"></div>
      <GossipSettings />
    </div>
  );
}
