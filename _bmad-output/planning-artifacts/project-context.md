---
project_name: 'meta-dj'
user_name: 'GeoloeG'
date: '2026-01-15'
sections_completed: ['technology_stack', 'implementation_rules', 'usage_guidelines']
existing_patterns_found: 4
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Runtime**: Browser (Chrome/Edge Only) - No Node.js runtime in production.
- **Build**: Vite (latest), ESBuild
- **Frontend**: React 19, TypeScript 5.x, Tailwind CSS
- **State**: Zustand (Main Thread), SharedArrayBuffer (Inter-thread)
- **Database**: SQLite WASM (OPFS backend) - Direct SQL Only
- **Audio**: Web Audio API + AudioWorklet
- **Compute**: WebGPU (ONNX Runtime)
- **Testing**: Vitest

## Critical Implementation Rules

1. **Split-Brain Isolation**: 
   - Code in `modules/audio/worker` and `modules/database/worker` MUST NOT import React, DOM types, or UI stores.
   - Code in `modules/*/components` MUST NOT access `sqlite3` or `AudioContext` directly.

2. **Database Integrity**:
   - Always use `snake_case` for SQL tables/columns to match Engine DJ (`m.db`, `p.db`).
   - Never use ORMs; write raw optimized SQL.

3. **Audio Performance**:
   - Zero allocation in the render loop.
   - Use `SharedArrayBuffer` for high-frequency control data.
   - Never block the main thread with heavy computation (offload to workers).

4. **Hardware I/O**:
   - All WebHID/WebMIDI access must happen in `hardware/worker`.
   - Normalize vendor-specific HID bytes into generic events before sending to UI.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-01-15
