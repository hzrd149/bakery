import { switchMap } from "rxjs";
import { createMemo, For, from } from "solid-js";
import { createQuery } from "bakery-common";

import bakery$ from "../../../services/connection";
import defined from "../../../operators/defined";

function ConnectionsCard(props: { class?: string }) {
  const connections = from(
    bakery$.pipe(
      defined(),
      switchMap((bakery) => createQuery(bakery, "connections")),
    ),
  );

  const connected = createMemo(
    () => connections() && Object.entries(connections()!).filter(([_, state]) => state).length,
  );

  return (
    <div class={`card bg-base-200 overflow-auto ${props.class}`}>
      <div class="card-body overflow-auto">
        <h2 class="card-title">Connected Relays ({connected()})</h2>
        <div class="overflow-auto">
          {connections() === undefined ? (
            <div class="flex justify-center items-center p-4">
              <span class="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <table class="table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={Object.entries(connections()!).sort(
                    (a, b) => (a[1].connected ? 1 : -1) - (b[1].connected ? 1 : -1),
                  )}
                >
                  {([relay, state]) => (
                    <tr>
                      <td class="truncate">{relay}</td>
                      <td>
                        <span
                          class={
                            "px-2 py-1 rounded-md " +
                            (state.connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")
                          }
                        >
                          {state.connected ? "Connected" : "Disconnected"}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConnectionsCard;
