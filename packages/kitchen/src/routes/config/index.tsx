import { A, RouteSectionProps } from "@solidjs/router";

import SimpleLayout from "../../components/simple-layout";

export default function ConfigView(props: RouteSectionProps) {
  return (
    <SimpleLayout title="Config">
      <div role="tablist" class="tabs tabs-lift mb-4">
        <a role="tab" class="tab">
          General
        </a>
        <A
          href="/config/network"
          role="tab"
          class="tab"
          activeClass="tab-active"
        >
          Network
        </A>
      </div>

      {props.children}
    </SimpleLayout>
  );
}
