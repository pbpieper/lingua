# Lingua — agent / multi-chat workflow

When doing large revisions, use:

1. **[`docs/MVP_REVISION_SYNTHESIS.md`](docs/MVP_REVISION_SYNTHESIS.md)** — synthesized product checklist (nothing from the MVP walkthrough should be dropped without an explicit decision).
2. **[`docs/AGENT_WORKSTREAMS.md`](docs/AGENT_WORKSTREAMS.md)** — parallel streams (A–L) with scope, dependencies, and definition of done.

**Prompt template for a dedicated chat:**

> Read `lingua/docs/MVP_REVISION_SYNTHESIS.md` and `lingua/docs/AGENT_WORKSTREAMS.md`. Implement **Agent [X]** only. List files touched and any handoffs to other agents.

Technical architecture: [`docs/developer-guide.md`](docs/developer-guide.md).
