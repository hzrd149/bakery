import pfs from "fs/promises";

export async function pathExists(path: string) {
  try {
    await pfs.stat(path);
    return true;
  } catch (error) {}
  return false;
}
