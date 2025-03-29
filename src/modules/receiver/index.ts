import {
  bufferTime,
  catchError,
  combineLatest,
  distinct,
  distinctUntilChanged,
  from,
  map,
  merge,
  Observable,
  ObservableInput,
  of,
  scan,
  share,
  shareReplay,
  Subject,
  switchMap,
  tap,
  throttleTime,
} from "rxjs";
import { createRxForwardReq, EventPacket, RxNostr, RxReq } from "rx-nostr";
import { ProfilePointer } from "nostr-tools/nip19";
import { Filter, kinds } from "nostr-tools";
import { getRelaysFromContactsEvent, isFilterEqual } from "applesauce-core/helpers";

import { FALLBACK_RELAYS, LOOKUP_RELAYS } from "../../env.js";
import { logger } from "../../logger.js";
import AsyncLoader from "../async-loader.js";
import { groupPubkeysByRelay } from "./relay-mapping.js";
import { lastN } from "../../helpers/rxjs.js";

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

export default class Receiver {
  log = logger.extend("Receiver");

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
              from(this.asyncLoader.replaceable(kinds.Contacts, contact.pubkey)).pipe(
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
          for (const [relay, pubkeys] of updated.entries()) {
            const filter: Filter = { authors: Array.from(pubkeys) };

            // only re-create the request if the filter has changed
            if (acc[relay] && isFilterEqual(acc[relay].filter, filter)) continue;

            this.log(`Subscribing to ${relay} with ${pubkeys.size} pubkeys`);

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
      // Subscribe to all requests
      switchMap(
        (requests) =>
          // A hack to ensure that the filters are emitted after the observable is subscribed to
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
      // Log when the receiver stops or has errors
      tap({ complete: () => this.log("Receiver stopped"), error: (e) => this.log("Receiver error", e.message) }),
      // Share so the pipeline its not recreated for each subscription
      share(),
    );

    // Log the average number of events received per minute over the last 5 minutes
    this.events$
      .pipe(
        distinct((e) => e.event.id),
        bufferTime(60_000), // Buffer events for 1 minute
        map((events) => events.length), // Count events in buffer
        lastN(5),
      )
      .subscribe((audits) => {
        const avg = audits.reduce((sum, val) => sum + val, 0) / audits.length;
        this.log(`Average ${avg.toFixed(2)} events/minute over the last ${audits.length} minutes`);
      });
  }
}
