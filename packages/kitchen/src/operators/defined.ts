import { filter, OperatorFunction } from "rxjs";

export default function defined<T>(): OperatorFunction<T, NonNullable<T>> {
  return filter((value) => value !== undefined && value !== null);
}
