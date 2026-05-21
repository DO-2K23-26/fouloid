import { pathToFileURL } from "node:url";
import { startApplication } from "./app/startApplication.js";
import { getConfigFromEnv } from "./config/getConfigFromEnv.js";

async function main() {
  await startApplication(getConfigFromEnv());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error("Application failed to start", error);
    process.exit(1);
  });
}
