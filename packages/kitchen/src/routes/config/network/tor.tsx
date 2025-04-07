import { JSX } from "solid-js";

import TorOutboundStatus from "./tor-outbound";
import TorInboundStatus from "./tor-inbound";
import useBakeryQuery from "../../../hooks/use-bakery-query";

export default function TorNetworkStatus() {
  const config = useBakeryQuery("config");
  const status = useBakeryQuery("network-status");

  let content: JSX.Element = null;

  if (status() === undefined || config() === undefined)
    content = <div class="loading-spinner" />;
  else {
    content = (
      <>
        <TorOutboundStatus />
        <TorInboundStatus />
      </>
    );
  }

  return (
    <>
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold">Tor</h2>
        <a
          href="https://www.torproject.org/"
          class="ml-auto text-gray-500 hover:text-gray-700"
          target="_blank"
          rel="noopener noreferrer"
        >
          More Info
        </a>
      </div>
      {content}
    </>
  );
}
