import { from } from "solid-js";

import PanelItemString from "../components/panel-item-string";
import { InfoIcon, ErrorIcon } from "../../../components/icons";
import { networkStatus } from "../../../services/bakery";

export default function I2PInboundStatus() {
  const network = from(networkStatus);

  if (network() === undefined) return null;
  else if (!network()!.i2p.inbound.available) {
    return (
      <div class="alert">
        <InfoIcon />
        Inbound connections from I2P are not available
      </div>
    );
  } else if (!network()!.i2p.inbound.running) {
    if (network()!.i2p.inbound.error)
      return (
        <div class="alert alert-error alert-soft">
          <ErrorIcon />
          I2P tunnel failed: {network()!.i2p.inbound.error}
        </div>
      );
    else return <div class="alert alert-loading">Start I2P tunnel...</div>;
  } else
    return (
      <PanelItemString
        label="I2P Address"
        value={network()!.i2p.inbound.address}
        isLoading={!network()!.i2p.inbound.address}
        qr
      />
    );
}
