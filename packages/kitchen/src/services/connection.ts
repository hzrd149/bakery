import { of } from "rxjs";
import { map, repeat, switchMap, shareReplay } from "rxjs/operators";
import { Relay } from "applesauce-relay";

import { bakeryUrl } from "./settings";
import defined from "../operators/defined";

const bakery$ = bakeryUrl.pipe(
  map((url) => (url ? new Relay(url) : null)),
  shareReplay(),
);

export const bakeryConnected = bakery$.pipe(
  switchMap((bakery) => (bakery ? bakery.connected$ : of(false))),
);

// always stay connected to the bakery
bakery$
  .pipe(
    defined(),
    switchMap((bakery) => bakery.message$),
    repeat(),
  )
  .subscribe();

if (import.meta.env.DEV) {
  // @ts-expect-error
  bakery$.subscribe((bakery) => (window.bakery = bakery));
}

export default bakery$;
