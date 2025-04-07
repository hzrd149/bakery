import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  from,
  map,
  merge,
  Observable,
  ObservableInput,
  of,
  scan,
  share,
  switchMap,
  tap,
  throttleTime,
} from "rxjs";
import { createRxForwardReq, EventPacket, RxNostr, RxReq } from "rx-nostr";
import { ProfilePointer } from "nostr-tools/nip19";
import { Filter, kinds } from "nostr-tools";
import { getRelaysFromContactsEvent, isFilterEqual, unixNow } from "applesauce-core/helpers";

import { FALLBACK_RELAYS, LOOKUP_RELAYS } from "../../env.js";
import { logger } from "../../logger.js";
import AsyncLoader from "../async-loader.js";
import { groupPubkeysByRelay } from "./relay-mapping.js";
import dayjs from "dayjs";

export type ReceiverConfig = {
  refreshInterval?: number;
  minRelaysPerPubkey?: number;
  maxRelaysPerPubkey?: number;
};

type OngoingRequest = {
  req: ReturnType<typeof createRxForwardReq>;
  filter: Filter;
  observable: Observable<EventPacket>;
};

type ReceiverState = {
  cursor?: number;
};

export default class Receiver {
  log = logger.extend("Receiver");

  state: ReceiverState = {};

  /** The outboxes for the root pubkey */
  outboxes$: Observable<string[]>;

  /** The contacts for the root pubkey */
  contacts$: Observable<ProfilePointer[]>;

  /** A map of the outbox relays for all the people in the contacts list */
  contactOutboxes$: Observable<Record<string, string[]>>;

  /** A map of the pubkeys for each relay */
  relayPubkeys$: Observable<Map<string, Set<string>>>;

  /** A map of the requests for each relay */
  requests$: Observable<Record<string, OngoingRequest>>;

  /** All the events fetched for the relays */
  events$: Observable<EventPacket>;

  constructor(
    protected root$: Observable<string>,
    protected asyncLoader: AsyncLoader,
    protected rxNostr: RxNostr,
    protected config: ReceiverConfig,
  ) {
    const root = this.root$.pipe(distinctUntilChanged());

    this.outboxes$ = root.pipe(
      switchMap((pubkey) =>
        from(this.asyncLoader.outboxes(pubkey, LOOKUP_RELAYS)).pipe(
          // Log when outboxes are loaded
          tap((outboxes) => this.log(`Found ${outboxes.length} outboxes for ${pubkey}`)),
        ),
      ),
      catchError(() => of(FALLBACK_RELAYS)),
    );

    this.contacts$ = combineLatest([root, this.outboxes$]).pipe(
      switchMap(([pubkey, outboxes]) =>
        from(this.asyncLoader.contacts(pubkey, outboxes)).pipe(
          // Log when contacts are loaded
          tap((contacts) => this.log(`Found ${contacts.length} contacts for ${pubkey}`)),
        ),
      ),
    );

    this.contactOutboxes$ = this.contacts$.pipe(
      switchMap((contacts) => {
        const directory: Record<string, ObservableInput<string[]>> = {};

        // Create an observable for each contact to load the outbox relays
        for (const contact of contacts) {
          directory[contact.pubkey] = from(this.asyncLoader.outboxes(contact.pubkey, LOOKUP_RELAYS)).pipe(
            catchError(() =>
              // If the outboxes fail, try to load the contacts event and parse the relays from it
              from(this.asyncLoader.replaceable(kinds.Contacts, contact.pubkey, undefined, LOOKUP_RELAYS)).pipe(
                map((event) => {
                  const parsed = getRelaysFromContactsEvent(event);
                  if (!parsed) throw new Error("No relays in contacts");
                  return Array.from(parsed.entries()).map(([r]) => r);
                }),
                // If that fails, use the fallback relays
                catchError(() => of(FALLBACK_RELAYS)),
              ),
            ),
          );
        }

        return combineLatest(directory);
      }),
    );

    this.relayPubkeys$ = this.contactOutboxes$.pipe(
      // only update the relay pubkeys every interval
      throttleTime(this.config.refreshInterval ?? 1000),
      map((directory) =>
        groupPubkeysByRelay(directory, this.config.minRelaysPerPubkey ?? 3, this.config.maxRelaysPerPubkey ?? 5),
      ),
    );

    this.requests$ = this.relayPubkeys$.pipe(
      scan(
        (acc, updated) => {
          this.log(`Last scan was ${this.state.cursor ? dayjs.unix(this.state.cursor).fromNow() : "never"}`);

          for (const [relay, pubkeys] of updated.entries()) {
            const filter: Filter = { authors: Array.from(pubkeys), since: this.state.cursor };

            // only re-create the request if the filter has changed
            if (acc[relay] && isFilterEqual(acc[relay].filter, filter)) continue;

            const req = createRxForwardReq();
            const observable = this.rxNostr.use(req, { on: { relays: [relay] } });

            acc[relay] = { req, filter, observable };
          }
          return acc;
        },
        {} as Record<string, OngoingRequest>,
      ),
    );

    let emitted = new WeakSet<RxReq<"forward">>();

    this.events$ = this.requests$.pipe(
      switchMap(
        (requests) =>
          // A hack to ensure that the filters are emitted after the observable is subscribed to
          // TODO: this should be updated to only emit new REQ when the pubkeys (filter) changes
          new Observable<EventPacket>((observer) => {
            // Merge all the observables into one
            const sub = merge(...Object.values(requests).map((r) => r.observable)).subscribe(observer);

            // Emit filters
            let count = 0;
            for (const request of Object.values(requests)) {
              if (emitted.has(request.req)) continue;

              count++;
              request.req.emit(request.filter);
              emitted.add(request.req);
            }

            if (count > 0) this.log(`Updated ${count} of ${Object.keys(requests).length} relay subscriptions`);

            return sub;
          }),
      ),
      tap({
        next: (packet) => {
          // Update the cursor to the latest event date
          this.state.cursor = Math.min(unixNow(), packet.event.created_at);
        },
        // Log when the receiver stops or has errors
        complete: () => this.log("Receiver stopped"),
        error: (e) => this.log("Receiver error", e.message),
      }),
      // Share so the pipeline its not recreated for each subscription
      share(),
    );
  }
}
