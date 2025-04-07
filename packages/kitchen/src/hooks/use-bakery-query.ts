import { Accessor, from } from "solid-js";
import { switchMap } from "rxjs";
import { createQuery, TBakeryQueries } from "bakery-common";

import bakery$ from "../services/connection";
import defined from "../operators/defined";

export default function useBakeryQuery<T extends keyof TBakeryQueries>(
  name: T,
  args?: TBakeryQueries[T][0],
): Accessor<TBakeryQueries[T][1] | undefined> {
  return from(
    bakery$.pipe(
      defined(),
      switchMap((bakery) => createQuery(bakery, name, args)),
    ),
  );
}
