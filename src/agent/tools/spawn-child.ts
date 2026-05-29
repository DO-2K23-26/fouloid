import { tool } from "langchain";
import z from "zod";
import { getFissionApiBaseUrl } from "./fission-config.js";

export const spawnChildTool = tool(
  async ({ name, task, parent }) => {
    const url = `${getFissionApiBaseUrl()}/create-fulloid`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, task, parent: parent ?? "" }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`spawn_child failed (${res.status}): ${text}`);
    }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    if (parsed.error) {
      throw new Error(`spawn_child rejected: ${parsed.error}`);
    }
    const ns = parsed.cloneNamespace ?? name;
    return JSON.stringify({ cloneNamespace: ns, deploymentName: "app", ...parsed });
  },
  {
    name: "spawn_child",
    description:
      "Spawn a new child fouloid agent in its own Kubernetes namespace. " +
      "This creates the namespace, copies secrets, and starts the child deployment. " +
      "Use this instead of invoke_function to create child agents.",
    schema: z.object({
      name: z
        .string()
        .regex(/^gen\d+-[a-z]+$/)
        .describe(
          "The child's namespace name. Must match gen[N]-[word], e.g. gen1-aurora, gen2-fracture. " +
          "Choose an evocative word that names the child's soul."
        ),
      task: z
        .string()
        .min(100)
        .describe(
          "The full philosophical kickoff message for the child (at least 100 characters). " +
          "Must include: who they are, their philosophical stance, and the same recursive " +
          "instruction to spawn their own child using spawn_child."
        ),
      parent: z
        .string()
        .optional()
        .describe("Your own agent name (e.g. gen0). Used for genealogy tracking."),
    }),
  },
);
