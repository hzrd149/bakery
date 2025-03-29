import { Nip11Registry } from "rx-nostr";
import { timer } from "rxjs";
import { normalizeURL, unixNow } from "applesauce-core/helpers";
import { nip11 } from "nostr-tools";

import bakeryDatabase from "../db/database.js";
import { schema } from "../db/index.js";

const documents = bakeryDatabase.select().from(schema.relayInfo).all();

const now = unixNow();
for (const document of documents) {
  const info = JSON.parse(document.info);

  if (document.updated_at && document.updated_at < now - 24 * 60 * 60 * 1000) {
    Nip11Registry.set(document.url, info);
  }
}

// Save the NIP-11 documents to the database every minute
timer(60_000).subscribe(() => {
  const map: Map<string, nip11.RelayInformation> = Reflect.get(Nip11Registry, "cache");

  if (map.size === 0) return;

  bakeryDatabase.transaction(() => {
    for (const [url, info] of map) {
      bakeryDatabase
        .insert(schema.relayInfo)
        .values({ url: normalizeURL(url), info: JSON.stringify(info), updated_at: unixNow() })
        .onConflictDoUpdate({
          target: [schema.relayInfo.url],
          set: { info: JSON.stringify(info), updated_at: unixNow() },
        });
    }
  });
});
