import { Subject } from "rxjs";

export class Session extends Subject<any> {
  constructor(public ws: WebSocket) {
    super();

    ws.addEventListener("message", (event) => {
      try {
        if (typeof event.data === "string") {
          const json = JSON.parse(event.data);
          this.next(json);
        }
      } catch (error) {}
    });

    ws.addEventListener("close", () => this.complete());
    ws.addEventListener("error", (err) => this.error(err));
  }

  send(message: any) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(message));
  }
}
