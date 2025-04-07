import { Observable } from "rxjs";
import { WebSocketServer, WebSocket } from "ws";

export function onConnection(wss: WebSocketServer): Observable<WebSocket> {
  return new Observable<WebSocket>((observer) => {
    const listener = (ws: WebSocket) => observer.next(ws);

    wss.on("connection", listener);
    return () => wss.off("connection", listener);
  });
}

export function onJSONMessage<T extends unknown = unknown>(ws: WebSocket) {
  return new Observable<T>((observer) => {
    const listener = (message: string | Buffer) => {
      try {
        observer.next(JSON.parse(String(message)));
      } catch (error) {}
    };

    ws.on("message", listener);
    return () => ws.off("message", listener);
  });
}
