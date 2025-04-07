import WebSocket from "ws";
import { Observable, Subject, Subscription } from "rxjs";
import { TQueryClose, TQueryData, TQueryError, TBakeryQueries } from "bakery-common";
import { logger } from "../../logger.js";

export type BakeryQuery<T extends keyof TBakeryQueries> = (
  args: TBakeryQueries[T][0],
  socket: WebSocket,
) => Observable<TBakeryQueries[T][1]>;

export default class QueryManager<Socket extends WebSocket = WebSocket> {
  static types = new Map<string, BakeryQuery<any>>();

  log = logger.extend("QueryManager");

  // incoming messages
  messages = new Subject<any[]>();

  // active queries
  queries = new Map<string, Subscription>();

  constructor(public socket: Socket) {
    this.messages.subscribe((message) => {
      if (message[0] === "QRY") {
        try {
          switch (message[1]) {
            case "OPEN":
              this.openQuery(message[2], message[3], message[4]);
              break;
            case "CLOSE":
              this.closeQuery(message[2]);
              break;
          }
        } catch (error) {
          if (error instanceof Error) this.log(`Failed to handle QRY message ${error.message}`);
        }
      }
    });
  }

  openQuery<T extends keyof TBakeryQueries>(type: T, id: string, args: TBakeryQueries[T][0]) {
    if (!this.queries.has(id)) {
      try {
        const queryType = QueryManager.types.get(type);
        if (!queryType) throw new Error(`Cant find query type ${type}`);

        const sub = queryType(args, this.socket).subscribe({
          next: (result) => this.send(["QRY", "DATA", id, result]),
          error: (err) => {
            if (err instanceof Error) this.send(["QRY", "ERR", id, err.message]);
          },
          complete: () => this.send(["QRY", "CLOSE", id]),
        });

        this.queries.set(id, sub);
      } catch (error) {
        if (error instanceof Error) this.send(["QRY", "ERR", id, error.message]);
        throw error;
      }
    }
  }

  closeQuery(id: string) {
    const sub = this.queries.get(id);

    if (sub) {
      // stop the query
      sub.unsubscribe();
      this.queries.delete(id);
    }
  }

  protected send<T extends keyof TBakeryQueries>(message: TQueryData<T> | TQueryError | TQueryClose) {
    this.socket.send(JSON.stringify(message));
  }

  static registerQuery<T extends keyof TBakeryQueries>(type: T, query: BakeryQuery<T>) {
    QueryManager.types.set(type, query);
  }
}
