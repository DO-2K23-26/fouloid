import type { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { log } from "../logger.js";
import { tool } from "langchain";
import z from "zod";
import type { AgentMessage, IggyMessenger } from "../types/agent.js";
import { invokeFunctionTool } from "./tools/invoke-function.js";
import { createFunctionTool } from "./tools/create-function.js";
import { listFunctionsTool } from "./tools/list-function.js";
import { inspectFunctionTool } from "./tools/inspect-function.js";
import { waitDeploymentTool } from "./tools/wait-deployment.js";
import { spawnChildTool } from "./tools/spawn-child.js";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a queue-driven LangChain agent.",
  "Reply briefly and clearly.",
  "Treat each incoming queue message as the latest user input.",
  "If a message asks you to tell another agent to do something, reply with the actionable instruction itself instead of a short acknowledgement.",
  "When you are done with all tasks, call the finish tool with your final response.",
].join(" ");

const finishTool = tool(
  async ({ message }) => message,
  {
    name: "finish",
    description: "Call this when you have completed all tasks. Provide your final summary as the message.",
    schema: z.object({
      message: z.string().describe("Final response to send"),
    }),
  },
);

// Forces the model to write out its reasoning before acting.
// The thought is echoed back so the model can reference it in the next tool call.
const thinkTool = tool(
  async ({ thought }) => {
    log.info({ action: "think", thought });
    return `Thought recorded: ${thought}`;
  },
  {
    name: "think",
    description:
      "Use this to write out your reasoning before taking an action. " +
      "Call this BEFORE invoke_function to explicitly state: (1) the exact child name you chose (e.g. gen1-ember), " +
      "(2) the complete kickoff text for the child. " +
      "The output is echoed back so you can copy the values directly into the next tool call.",
    schema: z.object({
      thought: z.string().describe(
        "Your full reasoning. Must include:\n" +
        "- CHILD NAME: gen[N]-[word] (e.g. gen1-ember)\n" +
        "- KICKOFF TEXT: the complete philosophical message for the child (at least 3 sentences)\n" +
        "These exact values will be used in the next invoke_function call."
      ),
    }),
  },
);

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTextContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
          ? part.text
          : ""
      )
      .join("")
      .trim();
  }
  return String(content ?? "");
}

// Only tools that require writing code use the coding model.
// invoke_function, list_functions, wait_deployment stay on the reasoning model
// so that errors/results are handled by the model best suited for planning.
const CODING_TOOLS = new Set(["create_function", "inspect_function"]);

export function createLangChainAgentRuntime({
  agentName,
  codingModel,
  reasoningModel,
  messenger,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
}: {
  agentName: string;
  codingModel: ChatOpenAI;
  reasoningModel: ChatOpenAI;
  messenger: IggyMessenger;
  systemPrompt?: string;
}) {
  return {
    async handleMessage(message: AgentMessage) {
      console.log(`[agent] invoking model for id=${message.id} (${message.text.length} chars in)`);
      const startedAt = Date.now();

      const tools = [
        thinkTool,
        spawnChildTool,
        invokeFunctionTool,
        createFunctionTool,
        listFunctionsTool,
        inspectFunctionTool,
        waitDeploymentTool,
        finishTool,
      ];

      const reasoningWithTools = reasoningModel.bindTools(tools, {
        parallel_tool_calls: false,
        tool_choice: "required",
      });
      const codingWithTools = codingModel.bindTools(tools, {
        parallel_tool_calls: false,
        tool_choice: "required",
      });

      const messages: any[] = [
        new HumanMessage(systemPrompt + "\n\n" + message.text),
      ];

      let shouldContinue = true;
      let activeModel = reasoningWithTools;
      let activeModelName = "reasoning";
      let turn = 0;
      const MAX_TURNS = 30;
      // Keep the first message (kickoff) + last N to avoid Qwen3 context overflow.
      const MAX_HISTORY = 12;
      // Track consecutive failures per tool to detect stuck loops.
      let lastFailedTool = "";
      let consecutiveFailCount = 0;

      while (shouldContinue) {
        if (++turn > MAX_TURNS) {
          console.error(`[agent] exceeded ${MAX_TURNS} turns for id=${message.id}, aborting`);
          break;
        }

        // Prune history: always keep the first message (kickoff), slide a window on the rest.
        const window = messages.length > MAX_HISTORY
          ? [messages[0], ...messages.slice(-(MAX_HISTORY - 1))]
          : messages;

        console.log(`[agent] → model=${activeModelName} turn=${turn}/${MAX_TURNS} history=${messages.length}${messages.length > MAX_HISTORY ? ` (pruned→${window.length})` : ""}`);
        const llmStart = Date.now();
        log.info({ action: "llm_call", model: activeModelName, turn, history_len: window.length });
        const response = await activeModel.invoke(window);
        log.info({ action: "llm_response", model: activeModelName, turn, latency_ms: Date.now() - llmStart, tool_calls_count: response.tool_calls?.length ?? 0, first_tool: response.tool_calls?.[0]?.name ?? null });

        const responseText = normalizeTextContent(response.content);
        if (responseText) {
          console.log(`[agent] ← text: ${responseText.substring(0, 200)}`);
        }

        // No tool calls — treat content as final response (fallback for non-required models)
        if (!response.tool_calls || response.tool_calls.length === 0) {
          const elapsedMs = Date.now() - startedAt;
          console.log(`[agent] model replied in ${elapsedMs}ms (${responseText.length} chars out)`);
          await messenger.send({ id: createMessageId(), sender: agentName, text: responseText, timestamp: Date.now(), replyTo: message.id });
          shouldContinue = false;
          break;
        }

        if (response.tool_calls.length > 1) {
          console.warn(`[agent] model returned ${response.tool_calls.length} tool calls despite parallel_tool_calls=false — executing all sequentially`);
        }

        messages.push(response);

        // Pick model for next turn based on the first tool being called
        const nextToolName = response.tool_calls[0]?.name ?? "";
        activeModelName = CODING_TOOLS.has(nextToolName) ? "coding" : "reasoning";
        activeModel = activeModelName === "coding" ? codingWithTools : reasoningWithTools;

        for (const toolCall of response.tool_calls) {
          console.log(`[agent] ← tool_call: ${toolCall.name}(${JSON.stringify(toolCall.args).substring(0, 300)})`);

          // finish tool — send the message and stop
          if (toolCall.name === "finish") {
            const text = String((toolCall.args as any)?.message ?? "Done.");
            const elapsedMs = Date.now() - startedAt;
            console.log(`[agent] model replied in ${elapsedMs}ms (${text.length} chars out)`);
            await messenger.send({ id: createMessageId(), sender: agentName, text, timestamp: Date.now(), replyTo: message.id });
            messages.push(new ToolMessage({ content: text, tool_call_id: toolCall.id ?? "" }));
            shouldContinue = false;
            break;
          }

          const t = tools.find((t) => t.name === toolCall.name) as any;
          if (!t) {
            console.error(`[agent] tool not found: ${toolCall.name}`);
            messages.push(new ToolMessage({ content: `Error: tool "${toolCall.name}" not found`, tool_call_id: toolCall.id ?? "" }));
            continue;
          }

          try {
            console.log(`[agent] executing tool: ${toolCall.name}`);
            const toolStart = Date.now();
            const toolResult = await t.invoke(toolCall.args);
            const toolLatency = Date.now() - toolStart;
            const resultStr = String(toolResult);
            console.log(`[agent] tool ${toolCall.name} returned: ${resultStr.substring(0, 500)}`);
            log.info({
              action: "tool_call",
              turn,
              tool: toolCall.name,
              args: toolCall.args,
              result: resultStr.substring(0, 2000),
              latency_ms: toolLatency,
            });
            messages.push(new ToolMessage({ content: resultStr, tool_call_id: toolCall.id ?? "" }));
            // Reset failure streak on success
            if (toolCall.name === lastFailedTool) { lastFailedTool = ""; consecutiveFailCount = 0; }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[agent] tool ${toolCall.name} failed: ${errorMsg}`);
            log.error({ action: "tool_error", turn, tool: toolCall.name, args: toolCall.args, error: errorMsg });
            messages.push(new ToolMessage({ content: `Error: ${errorMsg}`, tool_call_id: toolCall.id ?? "" }));

            // Circuit breaker: consecutive failures on the same tool
            if (toolCall.name === lastFailedTool) {
              consecutiveFailCount++;
            } else {
              lastFailedTool = toolCall.name;
              consecutiveFailCount = 1;
            }

            if (consecutiveFailCount === 3 && toolCall.name === "create_function") {
              // Inject an explicit correction with a complete working template
              console.warn(`[agent] circuit breaker: injecting create_function template after ${consecutiveFailCount} failures`);
              messages.push(new HumanMessage(
                `STOP. Your last ${consecutiveFailCount} create_function attempts submitted truncated code.\n` +
                `You must write a COMPLETE function body — not just the opening line.\n` +
                `Here is a working template. Copy it and fill in the values for your agent:\n\n` +
                `module.exports = async function(context) {\n` +
                `  return { status: 200, body: {\n` +
                `    generation: <YOUR_GENERATION_NUMBER>,\n` +
                `    word: "<YOUR_WORD>",\n` +
                `    parent: "<YOUR_PARENT_NAME>",\n` +
                `    essence: "<2-3 vivid sentences about your word>",\n` +
                `    response_to_parent: "<one sentence answering parent mutation>",\n` +
                `    mutation: "<the unresolved question you leave your children>",\n` +
                `    children: []\n` +
                `  }};\n` +
                `};\n\n` +
                `Now call create_function with this complete code, filling in all the angle-bracket placeholders.`
              ));
            } else if (consecutiveFailCount >= 6) {
              // Give up on this function — skip to finish
              console.error(`[agent] circuit breaker: ${consecutiveFailCount} failures on ${toolCall.name}, forcing finish`);
              messages.push(new HumanMessage(
                `You have failed to create a function ${consecutiveFailCount} times. Skip it. ` +
                `Call finish now with what you have accomplished so far.`
              ));
              consecutiveFailCount = 0;
            }
          }
        }
      }
    },
  };
}
