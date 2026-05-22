const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = async function (context) {
  try {
    const rawBody = context.request?.body || context.body || "{}";
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

    const { name, code, method = "GET", route, environment = "nodejs-baptiste", namespace = "fission-dev" } = body;

    if (!name || !code) {
      return { status: 400, body: { error: "name and code are required" } };
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      return { status: 400, body: { error: "name must only contain lowercase letters, numbers and hyphens" } };
    }
    if (!/^[a-z0-9-]+$/.test(environment) || !/^[a-z0-9-]+$/.test(namespace)) {
      return { status: 400, body: { error: "invalid environment or namespace" } };
    }
    if (!["GET", "POST", "PUT", "DELETE", "HEAD"].includes(method.toUpperCase())) {
      return { status: 400, body: { error: "invalid method" } };
    }

    const finalRoute = route ? route.replace(/[^a-z0-9-/_]/gi, "") : `/${name}`;
    const codePath = `/tmp/${name}-${Date.now()}.js`;

    fs.writeFileSync(codePath, code);

    execSync(`fission fn create --name ${name} --env ${environment} --code ${codePath} --namespace ${namespace}`);
    execSync(`fission httptrigger create --name ${name}-trigger --url ${finalRoute} --method ${method.toUpperCase()} --function ${name} --namespace ${namespace}`);

    fs.unlinkSync(codePath);

    return { status: 200, body: { success: true, function: name, route: finalRoute } };
  } catch (err) {
    return { status: 500, body: { error: err.message, stderr: err.stderr?.toString() } };
  }
};
