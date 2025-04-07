import { Show, For, from } from "solid-js";

import useBakeryAction from "../../../hooks/use-bakery-action";
import { bakeryConfig } from "../../../services/bakery";

function BroadcastRelay(props: { relay: string }) {
  const config = from(bakeryConfig);
  const update = useBakeryAction("config-update");

  return (
    <div class="flex gap-2 items-center overflow-hidden border p-2 rounded-md">
      {/* <RelayFavicon relay={props.relay} size="xs" /> */}
      <span class="truncate">{props.relay}</span>
      <button
        class="btn btn-ghost btn-xs btn-error ml-auto"
        onClick={() => {
          if (!config()) return;
          update.run({
            gossipBroadcastRelays: config()!.gossipBroadcastRelays?.filter((r) => r !== props.relay),
          });
        }}
        disabled={update.running()}
      >
        <i class="fas fa-times" />
      </button>
    </div>
  );
}

// function AddRelayForm() {
//   const controlApi = useObservable(controlApi$);
//   const config = useBakeryQuery("config");
//   const [form, { Form, Field }] = useForm({ initialValues: { url: "" } });

//   const onSubmit = async (values: { url: string }) => {
//     if (!config) return;
//     if (!isSafeRelayURL(values.url)) return;

//     const url = normalizeURL(values.url);
//     await controlApi?.setConfigField("gossipBroadcastRelays", [
//       ...config.gossipBroadcastRelays,
//       url,
//     ]);
//     form.reset();
//   };

//   return (
//     <Form onSubmit={onSubmit} class="flex gap-2">
//       <Field name="url">
//         {(field) => (
//           <input
//             type="url"
//             required
//             placeholder="wss://gossip.example.com"
//             class="input input-bordered flex-1"
//             {...field}
//           />
//         )}
//       </Field>
//       <button type="submit" class="btn btn-success">
//         Add
//       </button>
//     </Form>
//   );
// }

function IntervalSelect() {
  const config = from(bakeryConfig);
  const update = useBakeryAction("config-update");

  return (
    <select
      class="select select-bordered w-auto"
      value={config()?.gossipInterval}
      onChange={(e) => {
        const i = parseInt(e.currentTarget.value);
        if (Number.isFinite(i)) update.run({ gossipInterval: i });
      }}
    >
      <option value={60_000}>Every minute</option>
      <option value={10 * 60_000}>Every 10 min</option>
      <option value={30 * 60_000}>Every 30 min</option>
      <option value={60 * 60_000}>Every hour</option>
      <option value={24 * 60 * 60_000}>Every day</option>
    </select>
  );
}

export default function GossipSettings() {
  const config = from(bakeryConfig);
  const update = useBakeryAction("config-update");

  return (
    <>
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold">Gossip</h2>
        <Show when={config !== undefined}>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              class="toggle"
              checked={config()?.gossipEnabled}
              onChange={(e) =>
                update.run({
                  gossipEnabled: e.currentTarget.checked,
                })
              }
            />
            <span class="label-text ml-2">Enabled</span>
          </label>
        </Show>
        <a
          href="https://github.com/nostr-protocol/nips/blob/master/66.md"
          class="link link-neutral ml-auto"
          target="_blank"
          rel="noopener noreferrer"
        >
          More Info
        </a>
      </div>

      <div class="flex gap-2 justify-between">
        <p class="italic">Tell other relays and monitors how to reach this relay</p>
        <Show when={config()?.gossipEnabled}>
          <IntervalSelect />
        </Show>
      </div>

      <Show when={config()?.gossipEnabled}>
        {/* <AddRelayForm /> */}
        <div class="flex flex-col gap-2">
          <For each={config()?.gossipBroadcastRelays}>{(relay) => <BroadcastRelay relay={relay} />}</For>
        </div>
      </Show>
    </>
  );
}
