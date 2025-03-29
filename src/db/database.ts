import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";

import { DATABASE } from "../env.js";
import * as schema from "./schema.js";
import { setupEventFts } from "./search/events.js";
import { setupDecryptedFts } from "./search/decrypted.js";

const sqlite = new Database(DATABASE);
const bakeryDatabase = drizzle(sqlite, { schema });

export type BakeryDatabase = typeof bakeryDatabase;

// Run migrations first
migrate(bakeryDatabase, { migrationsFolder: "./drizzle" });

// Setup search tables after migrations
setupEventFts(sqlite);
setupDecryptedFts(sqlite);

export default bakeryDatabase;
