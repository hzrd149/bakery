import useBakeryAction from "../../../hooks/use-bakery-action";
import { from } from "solid-js";

import { bakeryConfig, networkStatus } from "../../../services/bakery";

export default function TorOutboundStatus() {
  const status = from(networkStatus);
  const config = from(bakeryConfig);
  const update = useBakeryAction("config-update");

  let content;
  if (status() === undefined) content = null;
  else if (!status()!.tor.outbound.available) {
    content = (
      <div role="alert" class="alert alert-warning">
        <span>Outbound connections to Tor are not available</span>
      </div>
    );
  } else if (status()!.tor.outbound.error) {
    content = (
      <div role="alert" class="alert">
        <span class="loading loading-spinner"></span>
        <span>Testing Tor proxy...</span>
      </div>
    );
  } else if (!status()!.tor.outbound.running && config()?.enableTorConnections) {
    content = (
      <div role="alert" class="alert alert-error">
        <span>Tor proxy failed: {status()!.tor.outbound.error}</span>
      </div>
    );
  }

  return (
    <>
      {status()?.tor.outbound.available && (
        <>
          <div>
            <label class="cursor-pointer">
              <span class="me-2">Connect to tor relays</span>
              <input
                type="checkbox"
                class="toggle"
                checked={config()?.enableTorConnections}
                onChange={(e) =>
                  update.run({
                    enableTorConnections: e.currentTarget.checked,
                  })
                }
              />
            </label>
            <p class="text-sm text-gray-500">Allows the node to connect to .onion domains</p>
          </div>

          <div>
            <label class="cursor-pointer">
              <span class="me-2">Route all traffic through tor proxy</span>
              <input
                type="checkbox"
                class="toggle"
                checked={config()?.routeAllTrafficThroughTor}
                onChange={(e) =>
                  update.run({
                    routeAllTrafficThroughTor: e.currentTarget.checked,
                  })
                }
              />
            </label>
            <p class="text-sm text-gray-500">
              Route all WebSocket and HTTP traffic through tor proxy. (This only applies to connections made by the
              node)
            </p>
          </div>
        </>
      )}
      {content}
    </>
  );
}
