import { parseArgs, ParseArgsConfig } from "node:util";

const config = {
  options: {
    mcp: { type: "boolean" },
    port: { type: "string", short: "p" },
  },
} as const satisfies ParseArgsConfig;

const args = parseArgs(config);

export default args;
