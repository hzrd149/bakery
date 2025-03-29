import { BehaviorSubject, Subject, tap, throttleTime } from "rxjs";
import { eq } from "drizzle-orm";

import { BakeryDatabase } from "../../db/database.js";
import { schema } from "../../db/index.js";
import { logger } from "../../logger.js";

function createMutableState<T extends object>(
  database: BakeryDatabase,
  key: string,
  initialState: T,
  throttle = 1000,
): T {
  const existing = database.select().from(schema.applicationState).where(eq(schema.applicationState.id, key)).get();

  // Use json.parse to create a new object
  const state = JSON.parse(existing?.state || JSON.stringify(initialState)) as T;

  // Save the state if it doesn't exist
  if (!existing)
    database
      .insert(schema.applicationState)
      .values({ id: key, state: JSON.stringify(state) })
      .run();

  const dirty = new BehaviorSubject(false);
  const save = new Subject<T>();

  // only save the state every x ms
  save
    .pipe(
      tap(() => dirty.value === false && dirty.next(true)),
      throttleTime(throttle),
    )
    .subscribe((state) => {
      database
        .update(schema.applicationState)
        .set({ state: JSON.stringify(state) })
        .where(eq(schema.applicationState.id, key))
        .run();

      dirty.next(false);
    });

  return new Proxy(state, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      Reflect.set(target, prop, value, receiver);
      save.next(target);
      return true;
    },
    deleteProperty(target, prop) {
      Reflect.deleteProperty(target, prop);
      save.next(target);
      return true;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}

export default class ApplicationStateManager {
  protected log = logger.extend("State");

  protected mutableState = new Map<string, any>();
  constructor(public database: BakeryDatabase) {}

  getMutableState<T extends object>(key: string, initialState: T): T {
    const existing = this.mutableState.get(key);
    if (existing) return existing as T;

    this.log(`Loading state for ${key}`);
    const state = createMutableState(this.database, key, initialState);
    this.mutableState.set(key, state);
    return state;
  }

  saveAll() {
    this.log("Saving all application states");
    for (const [key, state] of this.mutableState.entries()) {
      this.database
        .update(schema.applicationState)
        .set({ state: JSON.stringify(state) })
        .where(eq(schema.applicationState.id, key))
        .run();
    }
  }
}
