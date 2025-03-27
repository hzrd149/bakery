import debug, { Debugger } from "debug";
import { IS_MCP } from "./env.js";

if (!process.env.DEBUG) debug.enable("bakery,bakery:*");

type Listener = (logger: Debugger, ...args: any[]) => void;
const listeners = new Set<Listener>();

export function addListener(listener: Listener) {
  listeners.add(listener);
}
export function removeListener(listener: Listener) {
  listeners.delete(listener);
}

// listen for logs
debug.log = function (this: Debugger, ...args: any[]) {
  for (const listener of listeners) {
    listener(this, ...args);
  }

  // only log to console if not running in MCP mode
  if (!IS_MCP) console.log.apply(this, args);
};

export const logger = debug("bakery");
