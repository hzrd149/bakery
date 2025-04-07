import { TActionError, TActionResult, TBakeryActions } from "nostr-bakery-common";
import { Subject } from "rxjs";
import WebSocket from "ws";

import { logger } from "../../logger.js";

export default class ActionManager<Socket extends WebSocket = WebSocket> {
  static actions = new Map<string, (args: any) => Promise<any>>();

  log = logger.extend("ActionManager");

  // incoming messages
  messages = new Subject<any[]>();

  constructor(public socket: Socket) {
    this.messages.subscribe((message) => {
      if (message[0] === "ACT" && message[1] === "RUN") {
        try {
          this.handleAction(message[2], message[3], message[4]);
        } catch (error) {
          if (error instanceof Error) this.log(`Failed to handle ACT message ${error.message}`);
        }
      }
    });
  }

  static registerAction<T extends keyof TBakeryActions>(
    type: T,
    handler: (args: TBakeryActions[T][0]) => Promise<TBakeryActions[T][1]>,
  ) {
    ActionManager.actions.set(type, handler);
  }

  private async handleAction<T extends keyof TBakeryActions>(type: T, id: string, args: TBakeryActions[T][0]) {
    try {
      const handler = ActionManager.actions.get(type);
      if (!handler) throw new Error(`No handler registered for action type ${type}`);

      const result = await handler(args);
      this.send(["ACT", "RESULT", id, result]);
    } catch (error) {
      if (error instanceof Error) {
        this.send(["ACT", "ERR", id, error.message]);
      }
    }
  }

  protected send<T extends keyof TBakeryActions>(message: TActionResult<T> | TActionError) {
    this.socket.send(JSON.stringify(message));
  }
}
