import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { config } from './config.js'

export async function withMcp(fn) {
  const client = new Client({ name: 'gpower-chat', version: '0.1.0' }, { capabilities: {} })
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl))
  await client.connect(transport)
  try {
    return await fn(client)
  } finally {
    await client.close().catch(() => {})
  }
}

export function toOpenAiTools(mcpTools) {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }))
}

export function parseToolResult(result) {
  const text = result?.content?.find((c) => c.type === 'text')?.text
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
