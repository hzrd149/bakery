import fs from "fs";

const loadJson = (params: { path: string }) => {
  let object;

  try {
    const data = fs.readFileSync(params.path);

    object = JSON.parse(data.toString("utf8"));
  } catch (err) {
    console.log(err);
  }

  if (object) {
    return object;
  }
};

const saveJson = (data: any, params: { path: string }) => {
  try {
    fs.writeFileSync(params.path, Buffer.from(JSON.stringify(data)));
  } catch (err) {
    console.log(err);
  }
};

export { loadJson, saveJson };
