# Монорепо на npm workspaces с общим пакетом catalog-core

Логика каталога (данные, RU-словарь, фильтры, поиск) нужна и HTTP-API, и MCP-серверу. Выбрали монорепо на npm workspaces: `apps/web`, `apps/server`, `packages/catalog-core`, `packages/mcp-catalog`. Это даёт единый источник логики каталога, явные границы между пакетами и один `npm run dev` для поднятия всего.
