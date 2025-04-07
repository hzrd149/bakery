import { UpdateProfile } from "applesauce-actions/actions";
import { z } from "zod";

import mcpServer from "../server.js";
import { ownerActions, ownerPublish } from "../../owner-signer.js";

mcpServer.tool(
  "update_profile",
  "Updates the users profile",
  {
    name: z.string().optional().describe("The name of the user"),
    about: z.string().optional().describe("The about text of the user"),
    picture: z.string().url().optional().describe("The picture of the user"),
    nip05: z.string().email().optional().describe("The nip05 of the user"),
    website: z.string().url().optional().describe("The website of the user"),
  },
  async (content) => {
    await ownerActions.exec(UpdateProfile, content).forEach(ownerPublish);
    return { content: [{ type: "text", text: "Updated profile" }] };
  },
);
