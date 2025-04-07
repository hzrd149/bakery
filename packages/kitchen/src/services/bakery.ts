import { switchMap } from "rxjs/operators";
import { createQuery } from "bakery-common";

import defined from "../operators/defined";
import bakery$ from "./connection";

const bakery = bakery$.pipe(defined());

export const bakeryConfig = bakery.pipe(switchMap((bakery) => createQuery(bakery, "config")));
export const services = bakery.pipe(switchMap((b) => createQuery(b, "services")));
export const networkStatus = bakery.pipe(switchMap((b) => createQuery(b, "network-status")));
