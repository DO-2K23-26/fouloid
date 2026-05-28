const { execSync } = require("child_process");

module.exports = async function (context) {
  try {
    const query = context.request?.query || context.query || {};
    const namespace = query.namespace || "fission-dev";

    if (!/^[a-z0-9-]+$/.test(namespace)) {
      return { status: 400, body: { error: "invalid namespace" } };
    }

    const output = execSync(`fission function list -n ${namespace}`, {
      encoding: "utf8",
    });

    const lines = output.trim().split("\n").filter(Boolean);
    const headers = lines[0]
      .trim()
      .split(/\s{2,}/)
      .map((h) => h.toLowerCase());
    const nameIndex = headers.indexOf("name");

    const names = lines.slice(1).map((line) => {
      const values = line.trim().split(/\s{2,}/);
      return values[nameIndex] ?? "";
    });

    const functions = names.map((name) => {
      const code = execSync(`fission fn get --name ${name} -n ${namespace}`, {
        encoding: "utf8",
      });
      return { name, code };
    });

    return { status: 200, body: { namespace, functions } };
  } catch (err) {
    return {
      status: 500,
      body: { error: err.message, stderr: err.stderr?.toString() },
    };
  }
};
