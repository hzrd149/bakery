import { IEventStore, ISyncEventStore } from "applesauce-core";
import {
  getInboxes,
  getOutboxes,
  getProfileContent,
  getProfilePointersFromList,
  getReplaceableUID,
} from "applesauce-core/helpers";
import { simpleTimeout } from "applesauce-core/observable";
import { ReplaceableLoader, SingleEventLoader } from "applesauce-loaders/loaders";
import { filter, firstValueFrom, OperatorFunction } from "rxjs";
import { kinds } from "nostr-tools";

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

    return await firstValueFrom(
      this.store
        .replaceable(kind, pubkey, identifier)
        .pipe(this.addTimeout(`Failed to load replaceable event ${getReplaceableUID(kind, pubkey, identifier)}`)),
    );
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
