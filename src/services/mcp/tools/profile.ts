import { UpdateProfile } from "applesauce-actions/actions";
import { z } from "zod";

import { ownerPublish } from "../../owner-signer.js";
import mcpServer from "../server.js";
import { ownerActions } from "../../owner-signer.js";

mcpServer.tool(
  "update_profile",
  "Updates the owners profile",
  {
    name: z.string().optional().describe("The name of the owner"),
    about: z.string().optional().describe("The about text of the owner"),
    picture: z.string().url().optional().describe("The picture of the owner"),
    nip05: z.string().email().optional().describe("The nip05 of the owner"),
    website: z.string().url().optional().describe("The website of the owner"),
  },
  async (content) => {
    await ownerActions.exec(UpdateProfile, content).forEach(ownerPublish);
    return { content: [{ type: "text", text: "Updated profile" }] };
  },
);
