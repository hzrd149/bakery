import { Observable } from "rxjs";
import WebSocket from "ws";

export type Query<T extends unknown = unknown> = (args: T, socket: WebSocket) => Observable<any>;

// open query messages (id, type, args)
export type QueryOpen<Args extends unknown> = ["QRY", "OPEN", string, string, Args];
// close query message (id)
export type QueryClose = ["QRY", "CLOSE", string];

// error messages (id, message)
export type QueryError = ["QRY", "ERR", string, string];
// result message (id, data)
export type QueryData<Result extends unknown> = ["QRY", "DATA", string, Result];
