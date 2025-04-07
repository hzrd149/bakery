import { createSignal } from "solid-js";
import { TBakeryActions } from "bakery-common";
import { runAction } from "bakery-common/client/action";

import useBakery from "./use-bakery";

export default function useBakeryAction<T extends keyof TBakeryActions>(name: T) {
  const [running, setRunning] = createSignal(false);
  const bakery = useBakery();

  const run = async (args: TBakeryActions[T][0]) => {
    if (!bakery()) return;

    setRunning(true);
    try {
      const result = await runAction(bakery()!, name, args);
      setRunning(false);
      return result;
    } catch (error) {
      console.error(error);
      setRunning(false);
    }
  };

  return { running, run };
}
