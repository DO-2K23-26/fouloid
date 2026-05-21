# LangChain + Apache Iggy Multi-Agent System

A distributed multi-agent conversational system using:

- LangChain JS
- Apache Iggy
- OpenAI-compatible APIs
- Node.js

Agents communicate through a broadcast Apache Iggy topic.

---

# Features

- Multi-agent conversations
- OpenAI-compatible API support
- Distributed pub/sub architecture
- Lightweight memory
- Dockerized Apache Iggy
- Easy local development

---

# Requirements

- Node.js 20+
- Docker
- Docker Compose

---

# Supported LLM Backends

Any OpenAI-compatible endpoint:

- OpenAI
- Ollama
- LM Studio
- vLLM
- OpenRouter
- LocalAI

---

# Install

Clone the repository:

```bash
git clone <your-repo>
cd langchain-iggy-agents
```

Install dependencies:

```bash
npm install
```

---

# Configure Environment

Copy:

```bash
cp .env.example .env
```

Edit `.env`.

Example for Ollama:

```env
OPENAI_API_KEY=dummy
OPENAI_BASE_URL=http://localhost:11434/v1
MODEL_NAME=llama3

IGGY_ADDRESS=127.0.0.1:8090
IGGY_STREAM=agents
IGGY_TOPIC=broadcast
```

---

# Start Apache Iggy

Run:

```bash
docker compose up -d
```

Check logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

---

# Run Ollama Example

Install Ollama:

<https://ollama.com>

Pull model:

```bash
ollama pull llama3
```

Start Ollama:

```bash
ollama serve
```

---

# Run the Project

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

---

# Example Output

```text
[Alice] AI governance may reduce human conflict on Mars.

[Bob] Possibly, but colonists may resist algorithmic authority.

[Charlie] Hybrid democratic systems could balance both.
```

---

# Architecture

```text
+----------------+
| LangChain      |
| Agents         |
+--------+-------+
         |
         v
=====================
 Apache Iggy Bus
=====================
         |
         v
 OpenAI-compatible
 LLM endpoint
```

---

# Extending the System

You can add:

- Tool calling
- Shared memory
- LangGraph orchestration
- Vector databases
- Agent routing
- Directed messaging
- Streaming tokens
- Web search
- Autonomous workflows

---

# Recommended Improvements

## Directed messages

Current architecture uses broadcast.

For scalability:

```json
{
  "sender": "Alice",
  "target": "Bob",
  "text": "Hello"
}
```

---

## Persistent memory

Add:

- Redis
- PostgreSQL
- ChromaDB
- Weaviate

---

## Better orchestration

Recommended:

<https://langchain-ai.github.io/langgraphjs/>

---

# License

MIT
