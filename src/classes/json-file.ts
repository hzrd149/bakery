import { EventEmitter } from "events";
import { LowSync, SyncAdapter } from "lowdb";
import { JSONFileSync } from "lowdb/node";

type EventMap<T> = {
  /** fires when file is loaded */
  loaded: [T];
  /** fires when a field is set */
  changed: [T, string, any];
  /** fires when file is loaded or changed */
  updated: [T];
  saved: [T];
};

export class ReactiveJsonFile<T extends object> extends EventEmitter<EventMap<T>> implements LowSync<T> {
  protected db: LowSync<T>;
  adapter: SyncAdapter<T>;

  data: T;

  constructor(path: string, defaultData: T) {
    super();

    this.adapter = new JSONFileSync<T>(path);
    this.db = new LowSync<T>(this.adapter, defaultData);

    this.data = this.createProxy();
  }

  private createProxy() {
    return (this.data = new Proxy(this.db.data, {
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver);
      },
      set: (target, p, newValue, receiver) => {
        Reflect.set(target, p, newValue, receiver);
        this.emit("changed", target as T, String(p), newValue);
        this.emit("updated", target as T);
        return true;
      },
    }));
  }

  read() {
    this.db.read();
    this.emit("loaded", this.db.data);
    this.emit("updated", this.db.data);
    this.createProxy();
  }
  write() {
    this.db.write();
    this.emit("saved", this.db.data);
  }
  update(fn: (data: T) => unknown) {
    return this.db.update(fn);
  }

  setDefaults(defaults: Partial<T>) {
    // explicitly set default values if fields are not set
    for (const [key, value] of Object.entries(defaults)) {
      // @ts-expect-error
      if (this.data[key] === undefined) this.data[key] = value;
    }
    this.write();
  }

  setField(field: keyof T, value: T[keyof T]) {
    this.data[field] = value;
    this.write();
  }
}
