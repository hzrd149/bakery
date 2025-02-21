import { interval, map } from "rxjs";
import { Report } from "../manager.js";
import { default as OldReport } from "../report.js";
import { inboundNetwork, outboundNetwork } from "../../../services/network.js";

export default class NetworkStatusReport extends OldReport<"NETWORK_STATUS"> {
  readonly type = "NETWORK_STATUS";

  update() {
    const torIn = this.app.inboundNetwork.tor;
    const torOut = this.app.outboundNetwork.tor;
    const hyperIn = this.app.inboundNetwork.hyper;
    const hyperOut = this.app.outboundNetwork.hyper;
    const i2pIn = this.app.inboundNetwork.i2p;
    const i2pOut = this.app.outboundNetwork.i2p;

    this.send({
      tor: {
        inbound: {
          available: torIn.available,
          running: torIn.running,
          error: torIn.error?.message,
          address: torIn.address,
        },
        outbound: {
          available: torOut.available,
          running: torOut.running,
          error: torOut.error?.message,
        },
      },
      hyper: {
        inbound: {
          available: hyperIn.available,
          running: hyperIn.running,
          error: hyperIn.error?.message,
          address: hyperIn.address,
        },
        outbound: {
          available: hyperOut.available,
          running: hyperOut.running,
          error: hyperOut.error?.message,
        },
      },
      i2p: {
        inbound: {
          available: i2pIn.available,
          running: i2pIn.running,
          error: i2pIn.error?.message,
          address: i2pIn.address,
        },
        outbound: {
          available: i2pOut.available,
          running: i2pOut.running,
          error: i2pOut.error?.message,
        },
      },
    });
  }

  async setup() {
    const listener = this.update.bind(this);

    // NOTE: set and interval since there are not events to listen to yet
    const i = setInterval(listener, 1000);

    return () => clearInterval(i);
  }

  async execute(args: {}): Promise<void> {
    this.update();
  }
}

export type NetworkOutboundState = {
  available: boolean;
  running?: boolean;
  error?: string;
  address?: string;
};
export type NetworkInboundState = {
  available: boolean;
  running?: boolean;
  error?: string;
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

const NetworkStateReport: Report<{}, NetworkStateResult> = () =>
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

// export default NetworkStateReport
