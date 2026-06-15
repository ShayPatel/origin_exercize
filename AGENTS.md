# AGENTS.md — Event Management Platform

Agent-assisted build log, architecture reference, and decision record for this monorepo.

---

## What Was Built

A local-first, agentic Event Management Platform composed of three independent services:

| Service | Stack | Port | Role |
|---|---|---|---|
| `core-backend` | Python · FastAPI · SQLite · FastMCP | 8000 | Persistence, business rules, MCP tool server |
| `chat-backend` | Python · FastAPI · Google ADK 2.x · LiteLLM | 8001 | Agent orchestration, AG-UI SSE streaming |
| `frontend` | React 19 · Vite · Tailwind v4 · shadcn/ui | 5173 | Admin dashboard + agent chat tray |
| *(external)* | LM Studio | 1234 | Local offline LLM runtime |

The platform lets a human operator manage events directly through the admin UI (standard CRUD forms) **and** interact with a locally-running LLM agent through a chat panel that renders structured UI widgets inline when certain agent tool calls complete.

---

## How to Run

Each service runs in its own terminal. Start them in order because each depends on the one above it.

```bash
# 1. Core backend (database + MCP server)
cd core-backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 2. Chat backend (requires core-backend's MCP SSE endpoint to be up)
cd chat-backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

# 3. Frontend
cd frontend
pnpm dev
```

LM Studio must be running with a function-calling-capable model loaded at `http://127.0.0.1:1234` before any chat requests are made. The active model is configured in `chat-backend/app/config.py` as `LOCAL_MODEL` using the `lm_studio/<model-name>` prefix (e.g. `lm_studio/qwen3.6-35b-a3b`).

Open `http://localhost:5173`.

---

## Running Tests

```bash
# Core backend — 16 tests (service logic + in-process MCP tool calls)
cd core-backend && uv run pytest tests/ -v

# Chat backend — 10 tests (agent construction + AG-UI SSE event translation)
cd chat-backend && uv run pytest tests/ -v

# Frontend — 17 tests (hook state machine, widget rendering, registry routing)
cd frontend && npx vitest run
```

---

## Monorepo Layout

```
/event-manager
├── core-backend/
│   ├── app/
│   │   ├── config.py        Settings (DATABASE_URL, CORS_ORIGINS)
│   │   ├── models.py        SQLModel schemas: Event + Registration (UUID PKs)
│   │   ├── database.py      Engine, create_db_and_tables(), get_session()
│   │   ├── services.py      EventService — all business logic lives here
│   │   ├── mcp_server.py    FastMCP instance + 6 @mcp.tool() definitions
│   │   └── main.py          FastAPI app, CORS, MCP mount, REST endpoints
│   ├── tests/
│   │   ├── conftest.py      In-memory SQLite fixture
│   │   ├── test_services.py Service layer unit tests
│   │   └── test_mcp.py      In-process MCP tool call tests via fastmcp.Client
│   └── pyproject.toml
│
├── chat-backend/
│   ├── app/
│   │   ├── config.py        Settings (CORE_MCP_URL, LOCAL_MODEL, LM Studio coords)
│   │   ├── agent.py         build_agent() — constructs ADK Agent with LiteLlm + McpToolset
│   │   ├── agui_bridge.py   Custom AG-UI SSE bridge (ADK Events → AG-UI protocol lines)
│   │   └── main.py          FastAPI app, POST /api/v1/chat/stream endpoint
│   ├── tests/
│   │   ├── test_agent.py    Agent construction + config assertions
│   │   └── test_stream.py   Mocked runner SSE stream event sequence tests
│   └── pyproject.toml
│
└── frontend/
    ├── src/
    │   ├── App.tsx                     Split-grid layout (AdminPanel | ChatPanel)
    │   ├── main.tsx                    React root + QueryClientProvider
    │   ├── index.css                   Tailwind v4 + CSS custom property design tokens
    │   ├── lib/utils.ts                cn() helper (clsx + tailwind-merge)
    │   ├── hooks/
    │   │   ├── useEvents.ts            React Query hooks for /api/events REST
    │   │   └── useAguiStream.ts        AG-UI client subscription hook
    │   ├── components/
    │   │   ├── AdminPanel.tsx          Left panel: event list + create event form
    │   │   ├── ui/                     shadcn/ui primitives (card, badge, button, …)
    │   │   ├── chat/
    │   │   │   ├── ChatPanel.tsx       Right panel: scroll area + input
    │   │   │   ├── ChatMessage.tsx     Single message bubble + inline widget slot
    │   │   │   └── ChatInput.tsx       Input field with prefill support
    │   │   └── agui/
    │   │       ├── GenerativeUiRenderer.tsx  Registry dispatcher
    │   │       ├── AguiTicketWidget.tsx      Registration confirmation card
    │   │       └── AguiCapacityWidget.tsx    Capacity adjustment card
    │   └── tests/
    │       ├── setup.ts
    │       ├── hooks/useAguiStream.test.ts
    │       └── components/{GenerativeUiRenderer,AguiTicketWidget}.test.tsx
    ├── components.json                 shadcn/ui config
    ├── vite.config.ts                  Tailwind plugin, @ alias, dev proxy
    └── vitest.config.ts
```

---

## Architecture Decisions

### 1. Three-Service Boundary

The services are kept strictly separate because their failure modes and scaling profiles differ:

- **Core backend** is deterministic and transactional. It must never be coupled to the agent loop — if the LLM or LM Studio is down, humans can still manage events through the REST API and the admin UI.
- **Chat backend** is non-deterministic and stateless per request. It can be restarted, scaled, or swapped without touching the database.
- **Frontend** communicates with both independently. The Vite dev proxy routes `/api/events` → port 8000 and `/api/v1` → port 8001, so the browser never knows or cares about port numbers.

### 2. MCP as the Agent's API Surface (not REST)

The agent does not call the Core Backend's REST endpoints. Instead, the Core Backend hosts a **FastMCP SSE server** mounted at `/mcp` (SSE endpoint: `/mcp/sse`). The Chat Backend connects to it as an MCP client via `McpToolset(SseConnectionParams(...))`.

This gives three concrete benefits:
- The LLM receives structured JSON Schema tool definitions automatically derived from Python type annotations — no manual schema writing.
- Tool errors (raised `HTTPException`) are surfaced to the agent as MCP error content with a human-readable `detail` string, so the agent can reason about failures (e.g., "capacity is full, here are the available events instead").
- The agent's tool call history is part of the conversation context, which means multi-step flows (create event → register user → verify remaining spots) work without extra orchestration.

### 3. Custom AG-UI Bridge Instead of Third-Party Middleware

The spec referenced `adk_agui_middleware`. After investigation, the available PyPI package (`adk-agui-middleware` by Trend Micro) has an opaque API surface. Rather than depend on an external package whose internals are not transparent, we implemented `agui_bridge.py` directly.

The bridge translates ADK events by inspecting `event.content.parts`:
- `part.text` (non-thought, non-whitespace) → `TEXT_MESSAGE_START` / `TEXT_MESSAGE_CONTENT` / `TEXT_MESSAGE_END`
- `part.function_call` → `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END`
- `part.function_response` → `TOOL_CALL_RESULT`

Wrapped in `RUN_STARTED` / `RUN_FINISHED` (or `RUN_ERROR` on exception). Each event is streamed as `data: <json>\n\n` SSE.

The frontend uses `@ag-ui/client`'s `HttpAgent` class (`new HttpAgent({ url }).run(input)`) which parses this format into an RxJS `Observable<BaseEvent>`. **Critically**: `@ag-ui/client` validates every incoming SSE event against Zod schemas from `@ag-ui/core` (`EventSchemas.parse()`). Any event that fails schema validation terminates the entire Observable immediately. All emitted events must exactly match the required fields — see the TOOL_CALL_RESULT gotcha below.

### 4. Generative UI as an Opt-In Overlay on Normal Chat

The chat panel is **not** an agent-only interface. Humans can type any question and receive streamed plain-text responses. Widgets only appear when:
- A `TOOL_CALL_RESULT` event is received **and**
- The `toolCallName` maps to a known entry in `COMPONENT_REGISTRY` inside `GenerativeUiRenderer.tsx`

Currently, only two tools trigger widgets:

| Tool | Widget | Why |
|---|---|---|
| `register_user` | `AguiTicketWidget` | Gives the user a visual confirmation card with an Unregister affordance |
| `update_event_capacity` | `AguiCapacityWidget` | Shows old → new capacity with a fill-rate progress bar |

All other tools (`list_events`, `get_event`, `create_event`, `unregister_user`) let the agent's plain-text description stand. Adding a new widget requires only: (1) write the component, (2) add one entry to `COMPONENT_REGISTRY` and one entry to `TOOL_TO_WIDGET`. No other code changes needed.

The "Unregister" button on `AguiTicketWidget` does not call the REST API directly. It prefills the chat input with a natural-language string (e.g., "Unregister user alice from event Test Event") so the agent handles the cancellation, enforces the same business rules, and can ask for confirmation if needed.

### 5. UUID Primary Keys + spots_remaining Denormalisation

The spec chose UUIDs for all primary keys. This avoids auto-increment collisions if the database is ever replicated or seeded from external sources.

`Event.spots_remaining` is a denormalised integer that is decremented on registration and incremented on unregistration. The alternative — computing `capacity - COUNT(registrations)` on every read — would require a join on every capacity check. The denormalised field is cheaper and the business logic enforces consistency atomically (both the event update and the registration insert happen in the same SQLModel session commit). If they ever diverge, the source of truth is `capacity - spots_remaining`.

### 6. `temperature=0.0` via `generate_content_config`

Google ADK 2.x's `LlmAgent` does not accept `temperature` as a top-level constructor argument. It must be passed through `generate_content_config=GenerateContentConfig(temperature=0.0)`. Setting it to zero makes tool-selection behaviour deterministic, which matters for an event management assistant where "which tool to call" should not vary between runs.

### 7. Tailwind v4 CSS-First Configuration

Tailwind v4 eliminates `tailwind.config.js`. All theme tokens are defined as CSS custom properties in `src/index.css` under `@layer base {:root {...}}` and consumed via `hsl(var(--primary))` etc. The `@tailwindcss/vite` plugin handles compilation with no additional config file. The shadcn/ui components were generated using the CLI (`npx shadcn@latest add`) and moved into `src/components/ui/` — they import `@/lib/utils` which the Vite `@` alias resolves to `src/`.

### 8. Dependency Management

Python services use `uv`. Dependencies are **never edited into `pyproject.toml` by hand** — always via `uv add <package>` which resolves, pins, and writes to both `pyproject.toml` and `uv.lock` atomically. Frontend uses `pnpm`.

### 9. Admin Panel Refresh After Agent Mutations

The admin panel event list uses React Query (`useEvents`). When the agent creates, registers, or modifies events through MCP tools, those changes bypass the REST API so React Query's cache is stale. Rather than polling with `refetchInterval` (which fires continuously and is visible as noise in DevTools), `useAguiStream` calls `qc.invalidateQueries({ queryKey: ['events'] })` on `RUN_FINISHED`. This way the event list refreshes exactly once per completed agent turn, only when needed.

---

## The Six MCP Tools

All tools are defined in `core-backend/app/mcp_server.py` and delegate to `EventService` in `services.py`. FastMCP derives the JSON Schema from Python type annotations automatically.

| Tool | Parameters | Returns | Key business rule |
|---|---|---|---|
| `list_events` | — | `list[EventDict]` | Ordered by `event_date` ascending |
| `get_event` | `event_id: str` | `EventDict \| None` | Returns `None` (not an error) for unknown ID |
| `create_event` | `name, description, event_date (ISO 8601), capacity` | `EventDict` | `event_date` must be in the future (compared as naive UTC); `spots_remaining` initialised to `capacity` |
| `register_user` | `event_id, user_id` | `RegistrationDict` | Fails with descriptive message on: past event (422), full capacity (422), duplicate (409) |
| `unregister_user` | `event_id, user_id` | `{"success": true}` | Increments `spots_remaining` atomically; 404 if no matching registration |
| `update_event_capacity` | `event_id, new_capacity` | `EventDict` | Cannot reduce below current registration count; adjusts `spots_remaining` by the delta |

`EventDict`: `{id, name, description, event_date, capacity, spots_remaining}`
`RegistrationDict`: `{id, event_id, user_id, registered_at}`

---

## Key Package Versions

| Package | Version | Notes |
|---|---|---|
| `fastapi` | 0.137.0 | Core backend + chat backend |
| `sqlmodel` | 0.0.38 | ORM layer, wraps SQLAlchemy 2 |
| `fastmcp` | 3.4.2 | MCP server; `mcp.http_app(transport="sse")` returns a mountable Starlette ASGI app |
| `google-adk` | 2.2.0 | `Agent`, `Runner`, `McpToolset`, `LiteLlm` — import paths differ from 1.x |
| `litellm` | 1.89.0 | Routes LLM requests to LM Studio's OpenAI-compatible endpoint |
| `mcp` | 1.27.2 | MCP Python SDK (client side used by ADK's McpToolset) |
| `@ag-ui/client` | 0.0.57 | Frontend SSE consumer; `new HttpAgent({ url }).run(input)` returns an RxJS Observable |
| `@ag-ui/core` | 0.0.57 | `EventType` enum + `EventSchemas` Zod validators used in `useAguiStream.ts` |
| `react` | 19.2.7 | |
| `tailwindcss` | 4.3.1 | CSS-first, no `tailwind.config.js` |
| `@tailwindcss/vite` | 4.3.1 | Vite plugin for Tailwind v4 |

---

## Known Gotchas

**`TOOL_CALL_RESULT` must use `content`, not `result`** — The `@ag-ui/core` `EventSchemas` Zod validator requires `TOOL_CALL_RESULT` to have fields `messageId`, `toolCallId`, `content`, and `role`. If the bridge sends `result` instead of `content`, or omits `messageId`/`role`, `EventSchemas.parse()` throws and `@ag-ui/client` terminates the entire Observable with an error — silently killing all subsequent events including the final agent text response. Extra fields (e.g. `toolCallName` for widget routing) are passed through by Zod's default strip behaviour and are safe to include.

**Thinking models emit `Part(thought=True)` via ADK** — Models with chain-of-thought reasoning (Qwen, DeepSeek-R1, Gemini Thinking) return a `reasoning_content` field. ADK's LiteLLM integration converts this into `Part(text=..., thought=True)`. The bridge must check `not getattr(part, "thought", False)` before emitting a `TEXT_MESSAGE` event, otherwise the internal thinking trace appears as a chat bubble. The actual response text arrives in a separate non-thought Part.

**Intermediate `"\n\n"` content alongside tool calls** — When a thinking model makes a tool call, it sets `content: "\n\n"` and puts the actual call in `tool_calls`. ADK creates a Part for this whitespace content. The bridge filters it with `part.text.strip()` to avoid emitting empty chat bubbles.

**LiteLLM model prefix must be `lm_studio/`** — Using `openai/model-name` routes through LiteLLM's generic OpenAI-compatible path and triggers LM Studio's Jinja prompt template renderer for tool definitions. Some model templates (notably Gemma 4) call Jinja functions that LM Studio's runtime doesn't implement, producing a 400 error. Using `lm_studio/model-name` routes through LiteLLM's native LM Studio provider which handles tool serialisation differently and avoids the template issue.

**`event_date` timezone normalisation** — Incoming `event_date` values from the frontend (and from the agent) arrive as timezone-aware ISO 8601 strings (e.g. `2026-06-15T10:00:00Z`). SQLite stores naive datetimes. Before comparing against `datetime.utcnow()`, the bridge calls `.replace(tzinfo=None)` to strip the timezone designator. This compares naive values on both sides without converting — the assumption is that all datetimes are UTC.

**Agent midnight dates fail the future check** — When the model picks "midnight today/tomorrow" as an event date, the resulting naive UTC datetime may already be in the past relative to the server's `datetime.utcnow()` (especially if the user's local time is near midnight). This produces a 422 from the server. The agent recovers by retrying with a daytime hour. This is correct validation behaviour, not a bug.

**ADK experimental feature warnings** — ADK 2.x emits `UserWarning` for every experimental feature it uses on each request (`MCP_GRACEFUL_ERROR_HANDLING`, `BASE_AUTHENTICATED_TOOL`, `JSON_SCHEMA_FOR_FUNC_DECL`). These are silenced in `chat-backend/app/main.py` with `warnings.filterwarnings("ignore", category=UserWarning, module="google.adk")`. The features work correctly; the warnings are noise.

**`McpToolset` session lifecycle** — The `McpToolset` instance created in `build_agent()` opens a persistent SSE connection to the core-backend. Since `build_agent()` is called on every HTTP request in `main.py`, a new SSE connection is opened and closed per chat message. This is intentional for simplicity (stateless requests, no stale connection state), but it adds ~10ms of MCP handshake latency per turn. For higher-volume use, move `build_agent()` outside the request handler and handle reconnection logic.

**`@ag-ui/react` does not exist** — The npm registry has `@ag-ui/client` and `@ag-ui/core` but no `@ag-ui/react`. The frontend uses `@ag-ui/client`'s class-based API: `new HttpAgent({ url }).run(input)` returns an RxJS `Observable<BaseEvent>` consumed inside `useAguiStream.ts`. There is no standalone `runAgent` export.

**shadcn CLI writes to `@/components/ui/`** — With the current `components.json`, `npx shadcn add <component>` will write to a literal `@/` directory. After running it, move the generated files to `src/components/ui/` manually. This is a shadcn v4 alias resolution quirk on Windows.

**`datetime.utcnow()` deprecation** — Python 3.12 marks `datetime.utcnow()` as deprecated. The codebase uses it throughout for simplicity (SQLite stores naive UTC datetimes). Migrating to `datetime.now(UTC)` requires making all datetime fields timezone-aware in SQLModel, which is a non-trivial migration. The deprecation warnings are suppressed in tests but should be addressed before production use.

**`useAguiStream` test requires `QueryClientProvider`** — The hook calls `useQueryClient()` to invalidate the events cache on `RUN_FINISHED`. Tests that render this hook with `renderHook()` must provide a wrapper: `{ wrapper: ({ children }) => createElement(QueryClientProvider, { client: new QueryClient() }, children) }`.
