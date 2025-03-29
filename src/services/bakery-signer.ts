import { SimpleSigner } from "applesauce-signers";
import secrets from "./secrets.js";

const bakerySigner = new SimpleSigner(secrets.get("nostrKey"));

export default bakerySigner;
