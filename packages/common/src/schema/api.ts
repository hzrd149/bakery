import { TBakeryActions } from "./actions.js";
import { TBakeryQueries } from "./queries.js";

// Queries client -> server
export type TQueryOpen<T extends keyof TBakeryQueries> = ["QRY", "OPEN", T, string, TBakeryQueries[T][0]];
export type TQueryClose = ["QRY", "CLOSE", string];

// Queries server -> client
export type TQueryError = ["QRY", "ERR", string, string];
export type TQueryData<T extends keyof TBakeryQueries> = ["QRY", "DATA", string, TBakeryQueries[T][1]];

// Actions client -> server
export type TActionRun<T extends keyof TBakeryActions> = ["ACT", "RUN", T, string, TBakeryActions[T][0]];
export type TActionCancel<T extends keyof TBakeryActions> = ["ACT", "CANCEL", T, string];

// Actions server -> client
export type TActionError = ["ACT", "ERR", string, string];
export type TActionResult<T extends keyof TBakeryActions> = ["ACT", "RESULT", string, TBakeryActions[T][1]];
