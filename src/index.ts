import { startApplication } from "./app/startApplication.js";
import { getConfigFromEnv } from "./config/getConfigFromEnv.js";
import { pathToFileURL } from "node:url";

async function main() {
  await startApplication(getConfigFromEnv());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error("Application failed to start", error);
    process.exitCode = 1;
  });
}
