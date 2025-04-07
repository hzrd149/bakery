import { from } from "solid-js";

import useBakeryAction from "../../../hooks/use-bakery-action";
import { bakeryConfig, networkStatus } from "../../../services/bakery";

export default function HyperOutboundStatus() {
  const status = from(networkStatus);
  const config = from(bakeryConfig);
  const update = useBakeryAction("config-update");

  let content;
  if (status() === undefined) content = null;
  else if (!status()!.hyper.outbound.available) {
    content = (
      <div role="alert" class="alert alert-warning">
        <span>Outbound connections to HyperDHT node are not available</span>
      </div>
    );
  } else if (status()!.hyper.outbound.error) {
    content = (
      <div role="alert" class="alert alert-error">
        <span>HyperDHT proxy failed to start: {status()!.hyper.outbound.error}</span>
      </div>
    );
  } else if (!status()!.hyper.outbound.running && config()?.enableHyperConnections) {
    content = (
      <div role="alert" class="alert">
        <span class="loading loading-spinner"></span>
        <span>Starting HyperDHT proxy...</span>
      </div>
    );
  }

  return (
    <>
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Connect to hyper relays</span>
          <input
            type="checkbox"
            class="toggle"
            checked={config()?.enableHyperConnections}
            onChange={(e) =>
              update.run({
                enableHyperConnections: e.currentTarget.checked,
              })
            }
          />
        </label>
        <label class="label">
          <span class="label-text-alt">Allows the node to connect to .hyper domains</span>
        </label>
      </div>
      {content}
    </>
  );
}
