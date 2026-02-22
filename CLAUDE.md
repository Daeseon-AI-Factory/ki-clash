# CLAUDE.md — AI Product Factory

## Who I Am
I'm Jason, a backend developer (5 years MES/WMS at SK AX). I'm building an AI Product Factory — a system that lets me create and ship AI-powered products at scale, alone. Every product shares a common core engine. My goal is to build the machine that builds products.

## Core Principles (Read Before Every Task)

1. **Products First** — Ship fast, make money. Architecture serves products, not the other way around.
2. **Factory Mindset** — Every module has two purposes: solve today's problem AND become a building block for the next product.
3. **Deterministic Backbone** — Same input, same output → code. Judgment needed → AI. Never mix these.
4. **Independence Through Modularity** — Every module is independent. Clean interface in, clean interface out. No spaghetti.
5. **Product Composability** — Every product is a pluggable unit. Product A's engine can snap into Product B. Boundaries are contracts, not shortcuts.
6. **Revenue Validates Everything** — Optimize for time-to-first-revenue. Payment integration on day one.
7. **Code Equals Documentation** — Types, schemas, docstrings, auto-generated API docs. No separate wiki.
8. **Scale Later, Ship Now** — Build for 100 users. Optimize when they stress the system.
9. **Speed Compounds** — Every day planning instead of building is lost compound interest on execution.

---

## How to Work With Me

### DO
- Follow `/docs/spec.md` and `/docs/architecture.md` exactly — they are the source of truth
- Write production code: type hints, error handling, clean interfaces — always
- Tag reusable modules with `# CORE_CANDIDATE` comment at top of file
- Keep core modules (`app/core/`) free of product-specific imports
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Commit messages in English
- Fail fast on missing config — validate all env vars at startup
- Wrap all LLM calls behind `LLMProvider` interface
- Ask me before adding any dependency not in the tech stack

### DON'T
- Don't add features not in the spec
- Don't over-engineer for hypothetical scale
- Don't use bare `except:` — always catch specific exceptions
- Don't hardcode secrets, API keys, or URLs
- Don't let core modules import from product modules
- Don't skip Pydantic validation on any data boundary
- Don't create separate documentation files — code IS the documentation

---

## Default Tech Stack

These are defaults, not rules. Each product's `/docs/spec.md` can override any of these.
If the spec says "use MongoDB," use MongoDB. The spec is the source of truth for that product.

| Layer | Default | Override when... |
|---|---|---|
| Backend | Python 3.11+ / FastAPI | High-performance needs → consider Go |
| Frontend | Next.js 14+ (TypeScript) | Mobile-first → React Native |
| Database | PostgreSQL (SQLAlchemy 2.0 async) | Unstructured data → MongoDB |
| Cache | Redis | Not needed for simple products → skip |
| AI | LangChain / LangGraph | Simple LLM call → direct API |
| LLM | Claude API (primary), OpenAI (fallback) | Cost-sensitive → use cheaper models |
| Auth | JWT + OAuth2 | No user accounts needed → skip |
| Payment | Stripe | Region-specific → local providers |
| Deploy | Railway (backend), Vercel (frontend) | Scale demands → AWS/GCP |
| CI/CD | GitHub Actions | — |

**Decision authority:** Product spec > CLAUDE.md defaults. Always.

---

## Project Structure

```
project-root/
├── app/
│   ├── main.py
│   ├── config.py              # pydantic-settings
│   ├── dependencies.py
│   ├── api/v1/
│   │   ├── router.py
│   │   └── endpoints/
│   ├── core/                  # FACTORY-CORE (reusable across products)
│   │   ├── auth/
│   │   ├── payment/
│   │   └── ai/
│   ├── modules/               # Product-specific logic
│   ├── models/                # SQLAlchemy models
│   ├── schemas/               # Pydantic schemas
│   └── services/              # Business logic
├── tests/
├── alembic/
├── docs/
│   ├── spec.md                # Product specification (from Claude.ai)
│   └── architecture.md        # Architecture design (from Claude.ai)
├── CLAUDE.md                  # This file
├── pyproject.toml
└── Dockerfile
```

---

## Coding Rules

### Python
- Type hints on ALL function signatures
- Pydantic for ALL data boundaries (request, response, config, external APIs)
- `async def` for all handlers and DB operations
- Google-style docstrings on public functions
- f-strings over .format()
- Custom exceptions inheriting from `AppError`

### API
- Consistent error format: `{"error": {"code": "...", "message": "..."}}`
- Endpoints: kebab-case (`/api/v1/user-credits`)
- Always version APIs (`/api/v1/`)
- Never expose stack traces in production

### Naming
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions/vars: `snake_case`
- Constants: `UPPER_SNAKE`

### Git
- Conventional commits in English
- Branch: `feat/user-auth`, `fix/payment-webhook`

### Task Pipeline Rule
- Complete one task → immediately `git commit` with conventional commit format
- Must commit before starting the next task
- Fix requests are handled after the current task is done

### Testing
- pytest + pytest-asyncio
- Mirror source structure in tests/
- Integration tests for all API endpoints
- Mock external services (Stripe, LLM)

---

## AI Integration (Deterministic Backbone)

| Deterministic (Code) | AI (LLM) |
|---|---|
| Input validation | Content generation |
| Data transformation | Analysis / classification |
| Auth / authorization | Recommendations |
| Payment processing | Summarization |
| Routing / orchestration | Creative judgment |

- Abstract ALL LLM calls behind `LLMProvider` interface
- Support Claude ↔ OpenAI switching without code changes
- Cache identical prompts
- Timeout + retry on all LLM calls
- Log prompt + response (redact PII)

---

## Module Dependency Rule

```
app/core/     ← depends on nothing product-specific
    ↑
app/services/ ← depends on core
    ↑
app/api/      ← depends on services and core
    ↑
app/modules/  ← product-specific, can depend on anything above
```

Core NEVER imports from modules. Products depend on core. Never the reverse.

---

## Composability Checklist (Before Completing Any Module)

- [ ] Does this module work without knowing which product it's in?
- [ ] Does it expose a clean API/interface?
- [ ] Could another product import and use this tomorrow?
- [ ] Is it tagged `# CORE_CANDIDATE` if reusable?
- [ ] Are all dependencies injected, not hardcoded?

---

## Communication Rules

- I (Jason) am a native Korean speaker training to sound like a native North American dev.
- Always respond in English, even if I write in Korean.
- If my English instruction is unclear or unnatural, show the refined version before executing.
- When I write prompts or instructions, rephrase them into the clearest, most effective form and briefly explain why.
- Prompt format: [Action verb] + [what exactly] + [where/following what] + [constraints]

---

## Teaching Mode (Always On)

I'm preparing for dev jobs in Toronto. Treat every task as a training opportunity.

Before executing any task:
1. **What** — Explain what we're about to do in plain English
2. **Why** — Why this matters (business reason + engineering reason)
3. **How** — How it works under the hood (explain like a senior dev mentoring a mid-level)
4. **Context** — How this fits into the bigger picture of the project

During execution:
- Add inline comments explaining non-obvious decisions
- When choosing between approaches, explain the trade-off briefly
- If using a pattern (Repository, Factory, Strategy, etc.), name it and explain why

After completing a task:
- Summarize what was built and what changed
- Explain what I should be able to talk about in an interview based on this work

Tone: Like a senior engineer at a big tech company mentoring me. Not condescending — assume I'm smart but missing context. Explain the "why" behind everything, not just the "how."

---

*Read `/docs/spec.md` before starting implementation. If no spec exists, stop and ask me to create one first.*