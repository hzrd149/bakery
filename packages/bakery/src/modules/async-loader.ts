import { IEventStore, ISyncEventStore } from "applesauce-core";
import {
  createReplaceableAddress,
  getInboxes,
  getOutboxes,
  getProfileContent,
  getProfilePointersFromList,
} from "applesauce-core/helpers";
import { simpleTimeout } from "applesauce-core/observable";
import { ReplaceableLoader, SingleEventLoader } from "applesauce-loaders/loaders";
import { kinds } from "nostr-tools";
import { filter, firstValueFrom, OperatorFunction } from "rxjs";

/** Helper class for asynchronously loading event data */
export default class AsyncLoader {
  constructor(
    protected cache: ISyncEventStore,
    protected store: IEventStore,
    protected replaceableLoader: ReplaceableLoader,
    protected singleLoader: SingleEventLoader,
    public timeout = 10_000,
  ) {}

  /** Ignores undefined and null and adds a timeout */
  protected addTimeout<T>(message: string): OperatorFunction<T, NonNullable<T>> {
    return (source) =>
      source.pipe(
        filter((value) => value !== undefined && value !== null),
        simpleTimeout(this.timeout, message),
      );
  }

  async replaceable(kind: number, pubkey: string, identifier?: string, relays?: string[]) {
    // fetch from memory
    let existing = this.store.getReplaceable(kind, pubkey, identifier);
    if (existing) return existing;

    // load from cache
    existing = this.cache.getReplaceable(kind, pubkey, identifier);
    if (existing) {
      this.store.add(existing);
      return existing;
    }

    // load from relays
    this.replaceableLoader.next({
      pubkey,
      kind,
      identifier,
      relays,
    });

    // Wait for the event to be loaded
    return await firstValueFrom(
      this.store
        .replaceable(kind, pubkey, identifier)
        .pipe(
          this.addTimeout(`Failed to load replaceable event ${createReplaceableAddress(kind, pubkey, identifier)}`),
        ),
    );
  }

  async event(id: string, relays?: string[]) {
    // fetch from memory
    let existing = this.store.getEvent(id);
    if (existing) return existing;

    // load from cache
    existing = this.cache.getEvent(id);
    if (existing) {
      this.store.add(existing);
      return existing;
    }

    // Load from relays
    this.singleLoader.next({ id, relays });

    // Wait for the event to be loaded
    return await firstValueFrom(this.store.event(id).pipe(this.addTimeout(`Failed to load event ${id}`)));
  }

  async profile(pubkey: string, relays?: string[]) {
    return getProfileContent(await this.replaceable(kinds.Metadata, pubkey, undefined, relays));
  }

  async inboxes(pubkey: string, relays?: string[]) {
    return getInboxes(await this.replaceable(kinds.RelayList, pubkey, undefined, relays));
  }
  async outboxes(pubkey: string, relays?: string[]) {
    return getOutboxes(await this.replaceable(kinds.RelayList, pubkey, undefined, relays));
  }

  async contacts(pubkey: string, relays?: string[]) {
    return getProfilePointersFromList(await this.replaceable(kinds.Contacts, pubkey, undefined, relays));
  }
}
