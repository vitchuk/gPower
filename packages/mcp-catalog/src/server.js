import http from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { callTool, tools } from './catalog-service.js'

const PORT = Number(process.env.MCP_PORT || 3001)

function buildServer() {
  const server = new Server(
    { name: 'gpower-catalog', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      const result = await callTool(name, args || {})
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true,
      }
    }
  })

  return server
}

const httpServer = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/mcp')) {
    res.writeHead(404).end('not found')
    return
  }

  const server = buildServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  res.on('close', () => {
    transport.close()
    server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res)
  } catch (error) {
    console.error('[mcp-catalog] request error:', error)
    if (!res.headersSent) res.writeHead(500).end('internal error')
  }
})

httpServer.listen(PORT, () => {
  console.log(`[mcp-catalog] streamable HTTP MCP server on http://localhost:${PORT}/mcp`)
})
