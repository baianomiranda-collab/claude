import { workflow, trigger, node, ifElse, languageModel, memory, newCredential, expr, sticky } from '@n8n/workflow-sdk';

const desativarAgenteTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'DesativarAgente',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'IdConversa' },
          { name: 'TempoInatividadeAgente' },
          { name: 'WhatsAppHumano' }
        ]
      }
    }
  },
  output: [{ IdConversa: 'conv_123', TempoInatividadeAgente: 3600, WhatsAppHumano: '5581999999999' }]
});

const redisSetStatus = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis',
    parameters: {
      operation: 'set',
      key: expr('{{ $json.IdConversa }}_status'),
      value: 'Desativado',
      expire: true,
      ttl: expr('{{ $json.TempoInatividadeAgente }}')
    },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{ IdConversa: 'conv_123', TempoInatividadeAgente: 3600, WhatsAppHumano: '5581999999999', success: true }]
});

const noOpNoHuman = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'No Operation, do nothing', parameters: {} },
  output: [{}]
});

const postgresChatMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: {
    name: 'Postgres Chat Memory',
    parameters: {
      sessionIdType: 'customKey',
      sessionKey: expr('{{ $json.IdConversa }}'),
      contextWindowLength: 20
    },
    credentials: { postgres: newCredential('Postgres account') }
  }
});

const chatMemoryManager = node({
  type: '@n8n/n8n-nodes-langchain.memoryManager',
  version: 1.1,
  config: {
    name: 'Chat Memory Manager',
    parameters: {
      mode: 'load',
      simplifyOutput: true,
      options: {}
    },
    subnodes: { memory: postgresChatMemory }
  },
  output: [{ messages: 'Usuário: oi\nIA: olá, como posso ajudar?' }]
});

const anthropicSummaryModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Anthropic Chat Model1',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'claude-haiku-4-5-20251001', cachedResultName: 'Claude Haiku 4.5' },
      options: {}
    },
    credentials: { anthropicApi: newCredential('Anthropic account') }
  }
});

const basicLlmChain = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Basic LLM Chain',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.messages }}'),
      messages: {
        messageValues: [
          {
            message: expr('# Instruções | Faça um resumo da conversa realizada entre o usuário e a IA para ser repassado a um consultor especializado que irá dar seguimento nessa conversa.\n\n#Importante \n\n- Divida as mensagens de forma natural e humanizada;\n- Use quebras de linhas (\\n\\n) após pontos finais para legibilidade;\n- Para negrito (bold) use apenas um "*" nunca duas (exemplo: *negrito*).')
          }
        ]
      },
      batching: {}
    },
    subnodes: { model: anthropicSummaryModel }
  },
  output: [{ text: 'Resumo: usuário pediu suporte sobre X.' }]
});

const notifyHumanHttp = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'HTTP Request',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendHeaders: false,
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{\n{\n  "messageData": {\n    "to": String($("DesativarAgente").item.json.WhatsAppHumano),\n    "text": `⭐ Nova Solicitação de Atendimento\n\n🆔 *idConversa*\n${$("DesativarAgente").item.json.IdConversa}\n\n💭 *Resumo da Conversa*\n${$json.text}`\n  }\n}\n}}'),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{ success: true }]
});

const noOpAfterNotify = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'No Operation, do nothing1', parameters: {} },
  output: [{}]
});

const hasHumanNumber = ifElse({
  version: 2.3,
  config: {
    name: 'If',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.WhatsAppHumano.toString() }}'),
            rightValue: '',
            operator: { type: 'string', operation: 'exists', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    }
  }
});

const overviewNote = sticky('## Desativar Agente, Fazer Resumo da Conversa e Avisar Humano', [], { color: 5 });
const creditsNote = sticky('TEMPLATE DESENVOLVIDO POR NOCODE STARTUP\nhttps://nocodestartup.io/\n\nFORMAÇÃO GESTOR DE AGENTES DE IA:\nhttps://nocodestartup.io/formacao-gestor-agentes-ia/?utm_source=template-n8n', [], { color: 7 });

export default workflow('desativaragente-organon', 'DesativarAgente_Organon')
  .add(desativarAgenteTrigger)
  .to(redisSetStatus)
  .to(hasHumanNumber
    .onTrue(chatMemoryManager.to(basicLlmChain.to(notifyHumanHttp.to(noOpAfterNotify))))
    .onFalse(noOpNoHuman))
  .add(overviewNote)
  .add(creditsNote);
