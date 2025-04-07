import { lastValueFrom } from "rxjs";
import { map } from "rxjs/operators";
import { type MultiplexWebSocket } from "applesauce-relay";
import { nanoid } from "nanoid";

import { TBakeryActions, ZBakeryActions } from "../schema/actions.js";

/** Run a QRY against a websocket */
export async function runAction<T extends keyof TBakeryActions>(
  socket: MultiplexWebSocket,
  type: T,
  args?: TBakeryActions[T][0],
): Promise<TBakeryActions[T][1]> {
  const id = nanoid();

  // Parse the args
  args = ZBakeryActions[type][0].parse(args);

  // Create if it does not exist
  return lastValueFrom(
    socket
      .multiplex(
        () => ["ACT", "RUN", type, id, args],
        () => ["ACT", "CANCEL", id],
        (m) => m[0] === "ACT" && (m[1] === "RESULT" || m[1] === "ERR") && m[2] === id,
      )
      .pipe(
        map((message) => {
          // throw error
          if (message[1] === "ERR") throw new Error(message[2]);
          // return data
          else return message[3];
        }),
      ),
  );
}
