import { RelayPool } from "applesauce-relay";
import { interval, map } from "rxjs";

const pool = new RelayPool();

export const connections$ = interval(1000).pipe(
  map(() =>
    Object.fromEntries(
      Array.from(pool.relays.values()).map((relay) => [
        relay.url,
        { connected: relay.connected, authenticated: relay.authenticated },
      ]),
    ),
  ),
);

export default pool;
