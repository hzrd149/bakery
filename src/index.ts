#!/usr/bin/env node
import "./polyfill.js";
import process from "node:process";
import path from "node:path";

import express, { Request } from "express";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";

import App from "./app/index.js";
import { PUBLIC_ADDRESS, IS_MCP } from "./env.js";
import { addListener, logger } from "./logger.js";
import { pathExists } from "./helpers/fs.js";
import "./services/owner.js";

// add durations plugin
dayjs.extend(duration);
dayjs.extend(localizedFormat);

// create app
const app = new App();

// connect logger to app LogStore
addListener(({ namespace }, ...args) => {
  app.logStore.addEntry(namespace, Date.now(), args.join(" "));
});

function getPublicRelayAddressFromRequest(req: Request) {
  let url: URL;
  if (PUBLIC_ADDRESS) {
    url = new URL(PUBLIC_ADDRESS);
  } else {
    url = new URL("/", req.protocol + "://" + req.hostname);
  }
  url.protocol = req.protocol === "https:" ? "wss:" : "ws:";

  return url;
}

// if the app isn't setup redirect to the setup view
app.express.get("/", (req, res, next) => {
  if (!app.config.data.owner) {
    logger("Redirecting to setup view");

    const url = new URL("/bakery/setup", req.protocol + "://" + req.headers["host"]);
    const relay = getPublicRelayAddressFromRequest(req);
    url.searchParams.set("relay", relay.toString());
    res.redirect(url.toString());
  } else return next();
});

// serve the web ui or redirect to another hosted version
const appDir = (await pathExists("./nostrudel/dist")) ? "./nostrudel/dist" : "./public";
app.express.use(express.static(appDir));
app.express.get("*", (req, res) => {
  res.sendFile(path.resolve(appDir, "index.html"));
});

// log uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  if (reason instanceof Error) {
    console.log("Unhandled Rejection");
    console.log(reason);
  } else console.log("Unhandled Rejection at:", promise, "reason:", reason);
});

// start the app
await app.start();

// Setup MCP interface on stdio
if (IS_MCP) {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { default: server } = await import("./services/mcp/index.js");

  // connect MCP server to stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// shutdown process
async function shutdown() {
  logger("shutting down");

  await app.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// catch unhandled errors
process.on("uncaughtException", (error) => {
  if (!IS_MCP) console.error("Uncaught Exception:", error);
});

// 2. Catch unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  if (!IS_MCP) console.error("Unhandled Promise Rejection:", reason);
});
