import { workflow, trigger, node, languageModel, memory, tool, newCredential, expr } from '@n8n/workflow-sdk';

const chatTrigger = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: {
    name: 'When chat message received',
    parameters: {}
  },
  output: [{ chatInput: 'Quero marcar uma consulta amanhã às 10h', sessionId: 'abc123' }]
});

const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Chat Model',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4.1-mini' },
      builtInTools: {},
      options: {}
    },
    credentials: { openAiApi: newCredential('n8n free OpenAI API credits') }
  }
});

const simpleMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Simple Memory',
    parameters: {}
  }
});

const mcpClientTool = tool({
  type: '@n8n/n8n-nodes-langchain.mcpClientTool',
  version: 1.4,
  config: {
    name: 'MCP Client',
    parameters: {
      endpointUrl: 'https://bmiranda5.app.n8n.cloud/mcp/mcp-calendar',
      serverTransport: 'httpStreamable',
      authentication: 'none',
      include: 'all',
      options: {}
    }
  },
  output: [{ result: 'ok' }]
});

const aiAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AI Agent',
    parameters: {
      promptType: 'auto',
      options: {
        systemMessage: expr('Você é um atendente de agendamento\nA duração do agendamento é sempre de 1 hora.\n\nO dia de hoje é {{ $now }}')
      }
    },
    subnodes: { model: openAiModel, memory: simpleMemory, tools: [mcpClientTool] }
  },
  output: [{ output: 'Seu agendamento foi confirmado para amanhã às 10h.' }]
});

export default workflow('mcp-client', 'MCP Client')
  .add(chatTrigger)
  .to(aiAgent);
