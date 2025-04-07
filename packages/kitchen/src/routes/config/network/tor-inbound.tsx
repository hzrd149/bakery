import { from } from "solid-js";

import PanelItemString from "../components/panel-item-string";
import { InfoIcon, ErrorIcon } from "../../../components/icons";
import { networkStatus } from "../../../services/bakery";

export default function TorInboundStatus() {
  const status = from(networkStatus);

  if (status() === undefined) return <div class="loading loading-spinner" />;
  else if (!status()!.tor.inbound.available) {
    return (
      <div role="alert" class="alert">
        <InfoIcon />
        <span>Inbound connections from Tor are not available</span>
      </div>
    );
  } else if (!status()!.tor.inbound.running) {
    if (status()!.tor.inbound.error)
      return (
        <div role="alert" class="alert alert-error alert-soft">
          <ErrorIcon />
          Tor hidden service failed: {status()!.tor.inbound.error}
        </div>
      );
    else
      return (
        <div role="alert" class="alert">
          <InfoIcon />
          Start tor hidden service...
        </div>
      );
  } else
    return (
      <PanelItemString
        label="Onion Address"
        value={status()!.tor.inbound.address}
        isLoading={!status()!.tor.inbound.address}
        qr
      />
    );
}
