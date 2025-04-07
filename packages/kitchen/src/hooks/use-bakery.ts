import { from } from "solid-js";
import bakery$ from "../services/connection";
import defined from "../operators/defined";

export default function useBakery() {
  return from(bakery$.pipe(defined()));
}
