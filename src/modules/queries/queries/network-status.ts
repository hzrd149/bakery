import { interval, map } from "rxjs";
import { inboundNetwork, outboundNetwork } from "../../../services/network.js";
import { Query } from "../types.js";

export type NetworkOutboundState = {
  available: boolean;
  running?: boolean;
  error?: string;
};
export type NetworkInboundState = {
  available: boolean;
  running?: boolean;
  error?: string;
  address?: string;
};
export type NetworkState = {
  inbound: NetworkInboundState;
  outbound: NetworkInboundState;
};
export type NetworkStateResult = {
  tor: NetworkState;
  hyper: NetworkState;
  i2p: NetworkState;
};

const NetworkStateQuery: Query<NetworkStateResult> = () =>
  interval(1000).pipe(
    map(() => {
      const inbound = inboundNetwork;
      const outbound = outboundNetwork;

      return {
        tor: {
          inbound: {
            available: inbound.tor.available,
            running: inbound.tor.running,
            error: inbound.tor.error?.message,
            address: inbound.tor.address,
          },
          outbound: {
            available: outbound.tor.available,
            running: outbound.tor.running,
            error: outbound.tor.error?.message,
          },
        },
        hyper: {
          inbound: {
            available: inbound.hyper.available,
            running: inbound.hyper.running,
            error: inbound.hyper.error?.message,
            address: inbound.hyper.address,
          },
          outbound: {
            available: outbound.hyper.available,
            running: outbound.hyper.running,
            error: outbound.hyper.error?.message,
          },
        },
        i2p: {
          inbound: {
            available: inbound.i2p.available,
            running: inbound.i2p.running,
            error: inbound.i2p.error?.message,
            address: inbound.i2p.address,
          },
          outbound: {
            available: outbound.i2p.available,
            running: outbound.i2p.running,
            error: outbound.i2p.error?.message,
          },
        },
      };
    }),
  );

export default NetworkStateQuery;
