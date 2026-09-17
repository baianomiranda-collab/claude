import { workflow, trigger, node, tool, ifElse, switchCase, merge, splitInBatches, nextBatch, languageModel, memory, outputParser, newCredential, sticky, expr } from '@n8n/workflow-sdk';

// ============================================================
// GATILHO E FILTROS INICIAIS
// ============================================================

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { httpMethod: 'POST', path: 'AGENTE_ORGANONV1', options: {} }
  },
  output: [{
    body: {
      broadcast: false,
      isGroup: false,
      pushName: 'Cliente Teste',
      key: { senderPn: '5581999999999@s.whatsapp.net', remoteJid: '5581999999999@s.whatsapp.net', fromMe: false },
      message: {
        conversation: 'Olá, preciso de ajuda',
        audioMessage: { url: 'https://example.com/audio.enc', mediaKey: 'key123', directPath: '/path', mimetype: 'audio/ogg' },
        imageMessage: { url: 'https://example.com/img.enc', mediaKey: 'key123', directPath: '/path', mimetype: 'image/jpeg', caption: 'Olha essa foto' },
        documentWithCaptionMessage: { message: { documentMessage: { url: 'https://example.com/doc.enc', mediaKey: 'key123', directPath: '/path', mimetype: 'application/pdf', caption: 'Segue o documento' } } }
      }
    }
  }]
});

const centralDeControle = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Central de Controle',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: '9d694329-d97c-47ff-b5ed-df7c68e82456', name: 'espera_buffer', value: 8, type: 'number' },
          { id: '15dbe3ee-6bac-4fb6-9e16-006cc173ec91', name: 'temperatura_modelo', value: 0.4, type: 'number' },
          { id: '5c8644b9-b9eb-4a22-b20d-565a5cc5a6f0', name: 'TLL_desativar', value: 150, type: 'number' },
          { id: 'b4eb77ab-a2d5-4a18-9fc5-c91bd62d850a', name: 'WhatsappHumano', value: 558198082828, type: 'number' }
        ]
      },
      options: {}
    }
  },
  output: [{ espera_buffer: 8, temperatura_modelo: 0.4, TLL_desativar: 150, WhatsappHumano: 558198082828 }]
});

const filtroInicial1 = node({
  type: 'n8n-nodes-base.filter',
  version: 2.1,
  config: {
    name: 'Filtro Inicial1',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr("{{ $('Webhook').item.json.body.isGroup }}"), rightValue: '', operator: { type: 'boolean', operation: 'false', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    }
  },
  output: [{}]
});

const dadosLead = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Dados Lead',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: '9f488c5c-0b3b-48e9-87b1-5a22d513d1ec', name: 'IdConversa', value: expr("{{ $('Webhook').item.json.body.key.remoteJid.split('@')[0] }}"), type: 'string' },
          { id: '69f6217f-9063-423f-abf4-e94f6b70f94e', name: 'LeadNome', value: expr("{{ $('Webhook').item.json.body.pushName }}"), type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ IdConversa: '5581999999999', LeadNome: 'Cliente Teste' }]
});

// ============================================================
// GESTAO DO FLUXO DO AGENTE DESATIVANDO (intervencao humana)
// ============================================================

const desativaAgente = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Desativa Agente',
    parameters: {
      operation: 'set',
      key: expr("{{ $('Dados Lead').item.json.IdConversa }}_status"),
      value: 'Desativado',
      expire: true,
      ttl: expr("{{ $('Central de Controle').item.json.TLL_desativar }}")
    },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{ success: true }]
});

const postgresChatMemory1 = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: {
    name: 'Postgres Chat Memory1',
    parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ $('Dados Lead').item.json.IdConversa }}") },
    credentials: { postgres: newCredential('Postgres account') }
  }
});

const chatMemoryManager = node({
  type: '@n8n/n8n-nodes-langchain.memoryManager',
  version: 1.1,
  config: {
    name: 'Chat Memory Manager',
    parameters: {
      mode: 'insert',
      insertMode: 'insert',
      messages: { messageValues: [{ type: 'ai', message: expr("{{ $('Webhook').item.json.body.message.conversation }}") }] }
    },
    subnodes: { memory: postgresChatMemory1 }
  },
  output: [{}]
});

const noOpAfterDesativa = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing4', parameters: {} }, output: [{}] });

const redis7 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis7',
    parameters: { operation: 'get', propertyName: 'status_agente', key: expr("{{ $('Dados Lead').item.json.IdConversa }}_status"), options: {} },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{ status_agente: 'Ativo' }]
});

const postgresChatMemory2 = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: {
    name: 'Postgres Chat Memory2',
    parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ $('Dados Lead').item.json.IdConversa }}") },
    credentials: { postgres: newCredential('Postgres account') }
  }
});

const chatMemoryManager1 = node({
  type: '@n8n/n8n-nodes-langchain.memoryManager',
  version: 1.1,
  config: {
    name: 'Chat Memory Manager1',
    parameters: {
      mode: 'insert',
      insertMode: 'insert',
      messages: { messageValues: [{ message: expr("{{ $('Webhook').item.json.body.message.conversation }}") }] }
    },
    subnodes: { memory: postgresChatMemory2 }
  },
  output: [{}]
});

const noOpAfterDesativado = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing3', parameters: {} }, output: [{}] });

const eIntervencaoHumana = ifElse({
  version: 2.3,
  config: {
    name: 'É intervenção humana?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr("{{ $('Webhook').item.json.body.key.fromMe }}"), rightValue: 'True', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    }
  }
});

const botDesativado = ifElse({
  version: 2.3,
  config: {
    name: 'Bot Desativado?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.status_agente }}'), rightValue: 'Desativado', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    }
  }
});

// ============================================================
// TRATAMENTO POR TIPO DE MENSAGEM (Switch)
// ============================================================

const switchTipoMensagem = switchCase({
  version: 3.4,
  config: {
    name: 'Switch',
    parameters: {
      rules: {
        values: [
          { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Webhook').item.json.body.message.conversation }}"), rightValue: '', operator: { type: 'string', operation: 'exists', singleValue: true } }], combinator: 'and' }, renameOutput: true, outputKey: 'texto' },
          { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Webhook').item.json.body.message.audioMessage.url }}"), rightValue: '', operator: { type: 'string', operation: 'exists', singleValue: true } }], combinator: 'and' }, renameOutput: true, outputKey: 'audio' },
          { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Webhook').item.json.body.message.imageMessage.url }}"), rightValue: '', operator: { type: 'string', operation: 'exists', singleValue: true } }], combinator: 'and' }, renameOutput: true, outputKey: 'imagem' },
          { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mimetype }}"), rightValue: 'application/pdf', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'pdf' }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'outro' }
    }
  }
});

// -- Branch texto --
const mensagem1 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Mensagem1',
    parameters: { mode: 'manual', assignments: { assignments: [{ id: '66a91f66-e755-4120-b22f-44c814f56162', name: 'Mensagem', value: expr("{{ $('Webhook').item.json.body.message.conversation }}"), type: 'string' }] }, options: {} }
  },
  output: [{ Mensagem: 'Olá, preciso de ajuda' }]
});

const redis = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis',
    parameters: { operation: 'push', list: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"), messageData: expr('{{ $json.Mensagem }}'), tail: true },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{}]
});

// -- Branch audio --
const editFields2 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields2', parameters: { mode: 'manual', assignments: { assignments: [{ id: '1466f032-5c27-483c-8741-db5f400c50b4', name: 'audio', value: expr("{{ $('Webhook').item.json.body.message.audioMessage.url }}"), type: 'string' }] }, options: {} } },
  output: [{ audio: 'https://example.com/audio.enc' }]
});

const downloadMediaAudio = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'downloadMediaMessage (audio)',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/instance/downloadMediaMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{\n    "messageKeys": {\n        "mediaKey": "{{ $(\'Webhook\').item.json.body.message.audioMessage.mediaKey }}",\n        "directPath": "{{ $(\'Webhook\').item.json.body.message.audioMessage.directPath }}",\n        "url": "{{ $(\'Webhook\').item.json.body.message.audioMessage.url }}",\n        "mimetype": "{{ $(\'Webhook\').item.json.body.message.audioMessage.mimetype }}",\n        "messageType": "audio"\n    }\n}'),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{ data: 'data:audio/ogg;base64,AAAA' }]
});

const editFields3 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields3', parameters: { mode: 'manual', assignments: { assignments: [{ id: '0c725732-8ed0-4e32-9644-cb0126b652d3', name: 'data', value: expr("{{ $json.data.split(',') [1]}}"), type: 'string' }] }, options: {} } },
  output: [{ data: 'AAAA' }]
});

const convertToFile = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Convert to File',
    parameters: { operation: 'toBinary', sourceProperty: 'data', options: { fileName: 'audio_whatsapp.mp4', mimeType: expr("{{ $('Webhook').item.json.body.message.imageMessage.mimetype }}") } }
  },
  output: [{}]
});

const transcribeRecording = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Transcribe a recording',
    parameters: { resource: 'audio', operation: 'transcribe', options: {} },
    credentials: { openAiApi: newCredential('n8n free OpenAI API credits') }
  },
  output: [{ text: 'Transcrição do áudio do usuário' }]
});

const redis3 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: { name: 'Redis3', parameters: { operation: 'push', list: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"), messageData: expr('{{ $json.text }}'), tail: true }, credentials: { redis: newCredential('Redis account') } },
  output: [{}]
});

// -- Branch imagem --
const editFields5 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Edit Fields5',
    parameters: { mode: 'manual', assignments: { assignments: [
      { id: '1466f032-5c27-483c-8741-db5f400c50b4', name: 'imagem', value: expr("{{ $('Webhook').item.json.body.message.imageMessage.url }}"), type: 'string' },
      { id: 'dc62ccb7-4c3a-4ed5-9d93-86ee41db44c6', name: 'imagem_caption', value: expr("{{ $('Webhook').item.json.body.message.imageMessage.caption }}"), type: 'string' }
    ] }, options: {} }
  },
  output: [{ imagem: 'https://example.com/img.enc', imagem_caption: 'Olha essa foto' }]
});

const downloadMediaImagem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'downloadMediaMessage (imagem)',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/instance/downloadMediaMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{\n    "messageKeys": {\n        "mediaKey": "{{ $(\'Webhook\').item.json.body.message.imageMessage.mediaKey }}",\n        "directPath": "{{ $(\'Webhook\').item.json.body.message.imageMessage.directPath }}",\n        "url": "{{ $(\'Webhook\').item.json.body.message.imageMessage.url }}",\n        "mimetype": "{{ $(\'Webhook\').item.json.body.message.imageMessage.mimetype }}",\n        "messageType": "image"\n    }\n}'),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{ data: 'data:image/jpeg;base64,AAAA' }]
});

const editFields4 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields4', parameters: { mode: 'manual', assignments: { assignments: [{ id: '0c725732-8ed0-4e32-9644-cb0126b652d3', name: 'data', value: expr("{{ $json.data.split(',') [1]}}"), type: 'string' }] }, options: {} } },
  output: [{ data: 'AAAA' }]
});

const convertToFile1 = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: { name: 'Convert to File1', parameters: { operation: 'toBinary', sourceProperty: 'data', options: { fileName: 'imagem', mimeType: expr("{{ $('Webhook').item.json.body.message.imageMessage.mimetype }}") } } },
  output: [{}]
});

const analyzeImage = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Analyze image',
    parameters: {
      resource: 'image',
      operation: 'analyze',
      modelId: { __rl: true, mode: 'list', value: 'gpt-4o-mini', cachedResultName: 'GPT-4O-MINI' },
      text: expr("#Instruções\nO usuário te enviou uma imagem a qual você deve descrever.\n\nA imagem pode vir acompanhada de uma mensagem de texto (<MensagemUsuario>)\n\nCaso venha, utilize a mensagem anexa como contexto extra, tente capturar o sentimento da mensagem e objetivo pelo qual o usuário esteja enviando esta imagem na conversa.\n\nCrie uma resposta descrevendo as informações enviadas para que estas sejam utilizadas por um agente no futuro.\n\nLembre-se:\nEste agente apenas terá as informações que você fornecer, portanto repasse toda informação que julgar importante.\n\n#Dados\n<MensagemUsuario>\n{{ $json.imagem_caption }}\n</MensagemUsuario>\n"),
      inputType: 'base64',
      options: {}
    },
    credentials: { openAiApi: newCredential('n8n free OpenAI API credits') }
  },
  output: [{ content: [{ text: 'Descrição detalhada da imagem enviada.' }] }]
});

const redis4 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis4',
    parameters: {
      operation: 'push',
      list: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"),
      messageData: expr("<ContextoImagem>\n\n  <DetalheImagem>\n{{ $json['0'].content[0].text }}\n  </DetalheImagem>\n\nContexto Extra: O usuário encaminhou a mensagem a seguir junto á imagem.\n  <MensagemUsuario>\n{{ $('Edit Fields5').item.json.imagem_caption }}\n  </MensagemUsuario>\n\n</ContextoImagem>\n"),
      tail: true
    },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{}]
});

// -- Branch pdf --
const editFields6 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Edit Fields6',
    parameters: { mode: 'manual', assignments: { assignments: [
      { id: '1466f032-5c27-483c-8741-db5f400c50b4', name: 'pdf', value: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.url }}"), type: 'string' },
      { id: 'dc62ccb7-4c3a-4ed5-9d93-86ee41db44c6', name: 'pdf_caption', value: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.caption }}"), type: 'string' }
    ] }, options: {} }
  },
  output: [{ pdf: 'https://example.com/doc.enc', pdf_caption: 'Segue o documento' }]
});

const downloadMediaDocument = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'downloadMediaMessage document',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/instance/downloadMediaMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{\n    "messageKeys": {\n        "mediaKey": "{{ $(\'Webhook\').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mediaKey }}",\n        "directPath": "{{ $(\'Webhook\').item.json.body.message.documentWithCaptionMessage.message.documentMessage.directPath }}",\n        "url": "{{ $json.pdf }}",\n        "mimetype": "{{ $(\'Webhook\').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mimetype }}",\n        "messageType": "document"\n    }\n}'),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{ data: 'data:application/pdf;base64,AAAA' }]
});

const editFields7 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields7', parameters: { mode: 'manual', assignments: { assignments: [{ id: '0c725732-8ed0-4e32-9644-cb0126b652d3', name: 'data', value: expr("{{ $json.data.split(',') [1]}}"), type: 'string' }] }, options: {} } },
  output: [{ data: 'AAAA' }]
});

const convertToFile2 = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: { name: 'Convert to File2', parameters: { operation: 'toBinary', sourceProperty: 'data', options: { mimeType: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mimetype }}") } } },
  output: [{}]
});

const extractFromFile = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extract from File', parameters: { operation: 'pdf', options: {} } },
  output: [{ text: 'Texto extraído do PDF' }]
});

const redis5 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis5',
    parameters: {
      operation: 'push',
      list: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"),
      messageData: expr("<ContextoPDF>\n  <TranscricaoPDF>\n{{ $json.text }}\n  </TranscricaoPDF>\nContexto Extra: O usuário encaminhou a mensagem a seguir junto ao PDF.\n  <MensagemUsuario>\n{{ $('Edit Fields6').item.json.pdf_caption }}\n  </MensagemUsuario>\n</ContextoPDF>\n"),
      tail: true
    },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{}]
});

// -- Branch fallback (erro de formato) --
const editFields1 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields1', parameters: { mode: 'manual', assignments: { assignments: [{ id: 'f3d26a3d-940a-4235-acd3-5c96473527b7', name: 'Erro', value: '<ErroformatoMenssagem>', type: 'string' }] }, options: {} } },
  output: [{ Erro: '<ErroformatoMenssagem>' }]
});

const redis2 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: { name: 'Redis2', parameters: { operation: 'push', list: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"), messageData: expr('{{ $json.Erro }}'), tail: true }, credentials: { redis: newCredential('Redis account') } },
  output: [{}]
});

// ============================================================
// BUFFER / DEBOUNCE (converge das 5 ramificacoes) + CRIACAO DE USUARIO
// ============================================================

const redisBuffer1 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: { name: 'Redis_Buffer1', parameters: { operation: 'get', propertyName: 'menssagens', key: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"), options: {} }, credentials: { redis: newCredential('Redis account') } },
  output: [{ menssagens: ['Olá, preciso de ajuda'] }]
});

const wait = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait', parameters: { resume: 'timeInterval', amount: expr("{{ $('Central de Controle').item.json.espera_buffer }}") } },
  output: [{}]
});

const redisBuffer2 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: { name: 'Redis_Buffer2', parameters: { operation: 'get', propertyName: 'menssagens', key: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"), options: {} }, credentials: { redis: newCredential('Redis account') } },
  output: [{ menssagens: ['Olá, preciso de ajuda'] }]
});

const ifBufferEstavel = ifElse({
  version: 2.3,
  config: {
    name: 'If',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr("{{ $('Redis_Buffer1').item.json.menssagens.last() }}"), rightValue: expr('{{ $json.menssagens.last() }}'), operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    }
  }
});

const noOpBufferInstavel = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing1', parameters: {} }, output: [{}] });

const redis1 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: { name: 'Redis1', parameters: { operation: 'delete', key: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer") }, credentials: { redis: newCredential('Redis account') } },
  output: [{ menssagens: ['Olá, preciso de ajuda'] }]
});

const editFields = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields', parameters: { mode: 'manual', assignments: { assignments: [{ id: '420db834-1dbb-4035-90c1-16d2118e7728', name: 'menssagens', value: expr("{{ $json.menssagens.join('\\n\\n') }}"), type: 'string' }] }, options: {} } },
  output: [{ menssagens: 'Olá, preciso de ajuda' }]
});

const filter = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: {
    name: 'Filter',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          { id: '9dc31c1c-8feb-4087-b243-8f16a4c991b4', leftValue: expr('{{ $json.body.broadcast }}'), rightValue: false, operator: { type: 'boolean', operation: 'false', singleValue: true } },
          { id: '28bae4f2-5e62-46de-81cb-11d4d3d42e7a', leftValue: expr('{{ $json.body.isGroup }}'), rightValue: false, operator: { type: 'boolean', operation: 'false', singleValue: true } }
        ],
        combinator: 'and'
      },
      options: {}
    }
  },
  output: [{ menssagens: 'Olá, preciso de ajuda' }]
});

const simplificandoDados = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Simplificando Dados',
    parameters: { mode: 'manual', assignments: { assignments: [
      { id: 'acfdd769-f021-443e-9829-2a1bcb33b4b7', name: 'UsuarioNome', value: expr("{{ $('Webhook').item.json.body.pushName }}"), type: 'string' },
      { id: 'e6b7af86-cc21-4166-8731-0488399c3cef', name: 'UsuarioWhats', value: expr("{{ $('Webhook').item.json.body.key.senderPn.split('@')[0] }}"), type: 'string' },
      { id: 'b5626d1f-d4d7-4dff-ac9d-8af6ee78c6e1', name: 'Mensagem', value: expr("{{ $('Redis1').item.json.menssagens }}"), type: 'string' }
    ] }, options: {} }
  },
  output: [{ UsuarioNome: 'Cliente Teste', UsuarioWhats: '5581999999999', Mensagem: 'Olá, preciso de ajuda' }]
});

const procuraUsuario = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Procura Usuario',
    parameters: {
      resource: 'row',
      operation: 'get',
      tableId: 'usuarios',
      filters: { conditions: [{ keyName: 'whatsapp', keyValue: expr('{{ $json.UsuarioWhats }}') }] }
    },
    alwaysOutputData: true,
    credentials: { supabaseApi: newCredential('Supabase account') }
  },
  output: [{ id: 1, nome: 'Cliente Teste', whatsapp: '5581999999999' }]
});

const usuarioExiste = ifElse({
  version: 2.3,
  config: {
    name: 'Usuario Existe?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.id }}'), rightValue: 0, operator: { type: 'number', operation: 'exists', singleValue: true } }],
        combinator: 'and'
      },
      options: {}
    }
  }
});

const criarUsuario = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Criar Usuario',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'usuarios',
      fieldsUi: { fieldValues: [
        { fieldId: 'nome', fieldValue: expr("{{ $('Simplificando Dados').item.json.UsuarioNome }}") },
        { fieldId: 'whatsapp', fieldValue: expr("{{ $('Simplificando Dados').item.json.UsuarioWhats }}") }
      ] }
    },
    credentials: { supabaseApi: newCredential('Supabase account') }
  },
  output: [{ id: 2, nome: 'Cliente Teste', whatsapp: '5581999999999' }]
});

const unificando = merge({
  version: 3.2,
  config: { name: 'Unificando', parameters: { mode: 'append', numberInputs: 2 } }
});

// ============================================================
// MODULO TES (Code) + ROTEAMENTO
// ============================================================

const editFields11 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Edit Fields11',
    parameters: {
      mode: 'manual',
      assignments: { assignments: [
        { id: 'e98deabf-5262-437d-a9b9-f851bfcc23a7', name: 'mensagemTES', value: expr("{{ $('Simplificando Dados').item.json.Mensagem }}"), type: 'string' },
        { id: 'cbc76bdd-4ec5-443e-bb4b-f32d381348ca', name: 'whatsappTES', value: expr("{{ $('Simplificando Dados').item.json.UsuarioWhats }}"), type: 'string' }
      ] },
      includeOtherFields: true,
      options: {}
    }
  },
  output: [{ whatsapp: '5581999999999', mensagemTES: 'Olá, preciso de ajuda', whatsappTES: '5581999999999' }]
});

const codeInJavaScript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Code in JavaScript',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "const item = $input.first().json;\n\n// ── Pega mensagem e whatsapp passados pelo Set node anterior ──\nlet mensagem = item.mensagemTES || \"\";\nif (Array.isArray(mensagem)) mensagem = mensagem.join(\" \");\nmensagem = String(mensagem).trim();\n\nconst whatsapp = item.whatsappTES || item.whatsapp || \"\";\n\n// ============================================================\n// TABELA TES: antiga → nova\n// ============================================================\nconst REL = [\n  {antiga:200,desc:\"CONHEC.FRETE - COMPRA MATERIA PRIMA (COM ICMS)\",nova:350},\n  {antiga:201,desc:\"CONHEC.FRETE - COMPRA MATERIA PRIMA (SIMPLES NACIONAL)\",nova:351},\n  {antiga:202,desc:\"CONHEC.FRETE - FRETE VENDAS DE PRODUCAO (COM ICMS)\",nova:352},\n  {antiga:203,desc:\"CONHEC.FRETE - COMPRA MERCADORIA (COM ICMS)\",nova:353},\n  {antiga:204,desc:\"CONHEC.FRETE - FRETE VENDAS DE MERCADORIA (COM ICMS)\",nova:354},\n  {antiga:205,desc:\"CONHEC.FRETE - VENDAS DE MERCADORIAS - INTERMUNICIPAL (SEM ICMS)\",nova:355},\n  {antiga:206,desc:\"CONHEC.FRETE - VENDAS DE PRODUTOS - INTERMUNICIPAL (SEM ICMS)\",nova:356},\n  {antiga:207,desc:\"CONHEC.FRETE - VENDAS DE PRODUTOS - SIMPLES NACIONAL (SEM ICMS)\",nova:357},\n  {antiga:208,desc:\"CONHEC.FRETE - VENDAS DE MERCADORIAS - SIMPLES NACIONAL (SEM ICMS)\",nova:358},\n  {antiga:209,desc:\"CONHEC.FRETE - USO E CONSUMO (COM PIS E COFINS)\",nova:359},\n  {antiga:210,desc:\"CONHEC.FRETE - USO E CONSUMO (SEM PIS E COFINS)\",nova:360},\n  {antiga:211,desc:\"PE- CONHEC.FRETE IMOBILIZADO DE MAQUINAS E EQUIPAMENTOS (C/ ICMS E COM PIS E COFINS)\",nova:361},\n  {antiga:212,desc:\"CONHEC.FRETE - COMPRA MERCADORIA (SIMPLES NACIONAL)\",nova:362},\n  {antiga:213,desc:\"CONHEC.FRETE - SUBCONTRATACAO (COM PIS E COFINS)\",nova:363},\n  {antiga:214,desc:\"TECSIL - CONHEC.FRETE INTERESTADUAL - COMPRA DE MERCADORIA\",nova:364},\n  {antiga:215,desc:\"CONHECIMENTO DE FRETE - COMPLEMENTAR ICMS\",nova:365},\n  {antiga:216,desc:\"CONHEC.FRETE - COMPRA MATERIA PRIMA/EMBALAGEM (COM ICMS) - SEM NF\",nova:366},\n  {antiga:217,desc:\"CONHEC.FRETE - COMPRA MATERIA PRIMA/EMBALAGEM (SEM ICMS) - SEM NF\",nova:367},\n  {antiga:218,desc:\"CONHEC.FRETE - COMPRA MERCADORIA (COM ICMS) - SEM NF\",nova:368},\n  {antiga:219,desc:\"CONHEC.FRETE - COMPRA MERCADORIA (SEM ICMS) - SEM NF\",nova:369},\n  {antiga:220,desc:\"CONHEC.FRETE - FRETE VENDAS DE PRODUCAO (COM ICMS) - SEM NF\",nova:370},\n  {antiga:221,desc:\"CONHEC.FRETE - FRETE VENDAS DE MERCADORIA (COM ICMS) - SEM NF\",nova:371},\n  {antiga:222,desc:\"CONHEC.FRETE - VENDAS DE MERCADORIAS (SEM ICMS) - SEM NF\",nova:372},\n  {antiga:223,desc:\"CONHEC.FRETE - VENDAS DE PRODUTOS (SEM ICMS) - SEM NF\",nova:373},\n  {antiga:224,desc:\"CONHEC.FRETE - TRANSFERENCIA DE MERCADORIA (MTZ/FL)\",nova:374},\n  {antiga:225,desc:\"CONHEC.FRETE - TRANSFERENCIA DE MERCADORIA (MTZ/FL) - SEM NF\",nova:375},\n  {antiga:226,desc:\"CONHEC.FRETE - ARMAZENAGEM INTERNA\",nova:376},\n  {antiga:227,desc:\"CONHEC.FRETE - ARMAZENAGEM INTERESTADUAL\",nova:377},\n  {antiga:228,desc:\"CONHEC.FRETE - ARMAZENAGEM INTERNA - SEM NF\",nova:378},\n  {antiga:229,desc:\"CONHEC.FRETE - ARMAZENAGEM INTERESTADUAL - SEM NF\",nova:379},\n  {antiga:230,desc:\"CONHEC.FRETE - REMESSA TESTE/CONSERTO/COMODATO/VASILHAME E SACARIA/EXPORTACAO\",nova:380},\n  {antiga:231,desc:\"CONHEC.FRETE - IMOBILIZADOS (SEM PIS E COFINS)\",nova:381},\n  {antiga:232,desc:\"CONHEC.FRETE DE PASSAGEIROS\",nova:382},\n  {antiga:233,desc:\"CONHEC.FRETE - USO E CONSUMO (COM PIS E COFINS)-SEM NF\",nova:383},\n  {antiga:234,desc:\"CONHEC.FRETE - VENDAS DE MERCADORIAS - ZFM/EXPORTACAO (OPERACAO ISENTA)\",nova:384},\n  {antiga:235,desc:\"CONHEC.FRETE - DEVOLUCAO DE VENDA DE PRODUCAO (COM ICMS)\",nova:385},\n  {antiga:236,desc:\"CONHEC.FRETE - DEVOLUCAO DE VENDA DE MERCADORIA (COM ICMS)\",nova:386},\n  {antiga:237,desc:\"CONHEC.FRETE - DEVOLUCAO COMPRA DE MATERIA PRIMA (COM ICMS)\",nova:387},\n  {antiga:238,desc:\"CONHEC.FRETE - DEVOLUCAO COMPRA DE MERCADORIA (COM ICMS)\",nova:388},\n  {antiga:239,desc:\"CONHEC.FRETE - SEM CREDITO E SEM GERAR FINANCEIRO\",nova:389},\n  {antiga:240,desc:\"CONHEC.FRETE - VENDA - REMESSA POR CONTA E ORDEM\",nova:390},\n  {antiga:241,desc:\"CONHEC.FRETE - TRANSFERENCIA DE MERCADORIA (MTZ/FL)-ICMS GNRE\",nova:391},\n  {antiga:242,desc:\"CONHEC.FRETE - VENDAS DE MERCADORIAS (SEM ICMS)- GNRE\",nova:392},\n  {antiga:243,desc:\"PG BA-CONHEC.FRETE - FRETE VENDAS DE MERCADORIA (COM ICMS SUBSTITUTO)\",nova:393},\n  {antiga:279,desc:\"SP - CONHEC.FRETE IMOBILIZADO DE MAQUINAS E EQUIPAMENTOS (C/ ICMS E COM PIS E COFINS)\",nova:394},\n];\n\n// ── Funções ──────────────────────────────────────────────────\nfunction norm(s) {\n  return String(s).toUpperCase()\n    .normalize(\"NFD\").replace(/[\\u0300-\\u036f]/g, \"\")\n    .replace(/[^A-Z0-9 ]/g, \" \");\n}\n\nfunction isTESQuery(txt) {\n  const t = norm(txt);\n  const keywords = [\"TES\",\"NOVA TES\",\"SUBSTITUIU\",\"SUBSTITUI\",\"CODIGO TES\",\"CTE\",\"CONHEC FRETE\",\"CONHECIMENTO FRETE\"];\n  const hasKeyword = keywords.some(k => t.includes(k));\n  const nums = txt.match(/\\b\\d{3}\\b/g) || [];\n  const hasNum = nums.some(n => {\n    const v = parseInt(n);\n    return (v >= 200 && v <= 279) || (v >= 350 && v <= 394);\n  });\n  return hasKeyword || hasNum;\n}\n\nfunction buscar(q) {\n  const nums = q.match(/\\b\\d{3}\\b/g) || [];\n  for (const n of nums) {\n    const c = parseInt(n);\n    const porAntiga = REL.find(t => t.antiga === c);\n    if (porAntiga) return [porAntiga];\n    const porNova = REL.find(t => t.nova === c);\n    if (porNova) return [porNova];\n  }\n  const palavras = norm(q).split(\" \").filter(w => w.length > 2);\n  if (!palavras.length) return [];\n  return REL.filter(t => palavras.every(w => norm(t.desc).includes(w)));\n}\n\nfunction linha(...partes) {\n  return partes.join(\"\\n\");\n}\n\nfunction montarResposta(resultados, textoOriginal) {\n  const rodape = \"\\n─────────────────\\n🌐 *Portal de consulta completa:*\\nnovates.solucoesb4.com.br\";\n  let corpo = \"\";\n\n  if (!resultados.length) {\n    corpo = linha(\n      \"❌ *Nenhuma TES encontrada!*\",\n      \"_Busca: \" + textoOriginal + \"_\",\n      \"\",\n      \"Tente o código (ex: *200*) ou palavras da descrição:\",\n      \"• *TES 215*\",\n      \"• *armazenagem interna*\",\n      \"• *devolução compra*\"\n    );\n  } else if (resultados.length === 1) {\n    const r = resultados[0];\n    corpo = linha(\n      \"✅ *TES Localizada!*\",\n      \"\",\n      \"🔁 *Código Antigo:* \" + r.antiga,\n      \"✨ *Código Novo:*    \" + r.nova,\n      \"📄 *Descrição:* \" + r.desc.trim()\n    );\n  } else if (resultados.length <= 6) {\n    const lista = resultados.map(r =>\n      \"• *\" + r.antiga + \"* → *\" + r.nova + \"*\\n  _\" + r.desc.trim().slice(0, 55) + \"..._\"\n    ).join(\"\\n\\n\");\n    corpo = linha(\n      \"🔍 *\" + resultados.length + \" TES encontradas:*\",\n      \"\",\n      lista,\n      \"\",\n      \"_Use o código exato para mais detalhes._\"\n    );\n  } else {\n    corpo = linha(\n      \"⚠️ *Muitos resultados (\" + resultados.length + \")*\",\n      \"Seja mais específico.\",\n      \"Ex: *armazenagem interna* em vez de *armazenagem*\"\n    );\n  }\n\n  return corpo + rodape;\n}\n\n// ── Execução ─────────────────────────────────────────────────\nconst ehTES = mensagem.length > 0 && isTESQuery(mensagem);\nlet respostaTES = \"\";\n\nif (ehTES) {\n  const resultados = buscar(mensagem);\n  respostaTES = montarResposta(resultados, mensagem);\n}\n\n// Preserva \\n mas remove demais caracteres de controle\nconst respostaSafe = respostaTES\n  .replace(/\\r/g, \"\")\n  .replace(/\\t/g, \" \")\n  .replace(/[\\u0000-\\u0009\\u000B-\\u001F\\u007F]/g, \" \");\n\n// Body já montado como objeto — não precisa serializar no HTTP Request\nconst bodyMega = {\n  messageData: {\n    to: whatsapp,\n    text: respostaSafe\n  }\n};\n\nreturn [{\n  json: {\n    ...item,\n    whatsapp,\n    mensagemTES: mensagem,\n    ehTES,\n    respostaTES: respostaSafe,\n    bodyMega,\n  }\n}];"
    },
    retryOnFail: false
  },
  output: [{ whatsapp: '5581999999999', mensagemTES: 'Olá, preciso de ajuda', ehTES: false, respostaTES: '' }]
});

const if1TES = ifElse({
  version: 2.3,
  config: {
    name: 'If1',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ehTES }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      },
      looseTypeValidation: true,
      options: {}
    }
  }
});

const httpRequest2 = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'HTTP Request2',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      bodyParameters: { parameters: [
        { name: 'messageData.to', value: expr('{{ $json.whatsapp }}') },
        { name: 'messageData.text', value: expr('{{ $json.respostaTES }}') }
      ] },
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{}]
});

const noOpAposTES = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing6', parameters: {} }, output: [{}] });

// ============================================================
// AGENTE DE IA
// ============================================================

const anthropicChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Anthropic Chat Model',
    parameters: { model: { __rl: true, mode: 'list', value: 'claude-haiku-4-5-20251001', cachedResultName: 'Claude Haiku 4.5' }, options: {} },
    credentials: { anthropicApi: newCredential('Anthropic account') }
  }
});

const postgresChatMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: {
    name: 'Postgres Chat Memory',
    parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ $('Unificando').item.json.whatsapp }}") },
    credentials: { postgres: newCredential('Postgres account') }
  }
});

const desativarAgenteTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'DesativarAgente',
    parameters: {
      description: expr('# Intruções\n- Use essa tool para passar a conversa para um humano.\n- Antes de passar a conversa para um humano, explique para o cliente como você pode ajuda-lo e confirme se mesmo assim deseja seguir com atendimento humano ou seguir com atendimento normal\n\n# Resposta de sucesso:\nResponda ao usuário que a conversa foi encaminhada para um consultor especializado que logo irá entrar em contato e dar seguimento no atendimento.\n'),
      source: 'database',
      workflowId: { __rl: true, mode: 'list', value: 'tbR0Zs35oyRFnT2J', cachedResultUrl: '/workflow/tbR0Zs35oyRFnT2J', cachedResultName: 'DesativarAgente_Organon' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          IdConversa: expr("{{ String($('Dados Lead').item.json.IdConversa) }}"),
          TempoInatividadeAgente: expr("{{ $('Central de Controle').item.json.TLL_desativar }}"),
          WhatsAppHumano: expr("{{ String($('Central de Controle').item.json.WhatsappHumano) }}")
        },
        matchingColumns: [],
        schema: [
          { id: 'IdConversa', displayName: 'IdConversa', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'TempoInatividadeAgente', displayName: 'TempoInatividadeAgente', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'WhatsAppHumano', displayName: 'WhatsAppHumano', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      }
    }
  },
  output: [{ output: 'Conversa encaminhada para atendimento humano.' }]
});

const criarProjetoTool = tool({
  type: 'n8n-nodes-base.mySqlTool',
  version: 2.5,
  config: {
    name: 'criar_projeto',
    parameters: { operation: 'select', table: { __rl: true, mode: 'list', value: 'projeto', cachedResultName: 'projeto' }, where: { values: [{ column: 'CODSETOR', value: 'CNT' }] }, options: {} },
    credentials: { mySql: newCredential('MySQL account') }
  },
  output: [{}]
});

const atualizaProjetoTool = tool({
  type: 'n8n-nodes-base.mySqlTool',
  version: 2.5,
  config: {
    name: 'atualiza_projeto',
    parameters: { operation: 'select', table: { __rl: true, mode: 'list', value: 'projeto', cachedResultName: 'projeto' }, where: { values: [{ column: 'CODSETOR', value: 'CNT' }] }, options: {} },
    credentials: { mySql: newCredential('MySQL account') }
  },
  output: [{}]
});

const pesquisarProjetoTool = tool({
  type: 'n8n-nodes-base.mySqlTool',
  version: 2.5,
  config: {
    name: 'pesquisar_projeto',
    parameters: { operation: 'select', table: { __rl: true, mode: 'list', value: 'projeto', cachedResultName: 'projeto' }, where: { values: [{ column: 'CODSETOR', value: 'CNT' }] }, options: {} },
    credentials: { mySql: newCredential('MySQL account') }
  },
  output: [{}]
});

const disparaCashupPgTool = tool({
  type: 'n8n-nodes-base.githubTool',
  version: 1.1,
  config: {
    name: 'disparar_relatorio_cashup_pg',
    parameters: {
      resource: 'workflow',
      operation: 'dispatch',
      authentication: 'accessToken',
      owner: { __rl: true, mode: 'name', value: 'baianomiranda-collab' },
      repository: { __rl: true, mode: 'name', value: 'claude' },
      workflowId: { __rl: true, mode: 'list', value: 342977972, cachedResultName: 'Relatorio Orcamentos Cash-UP PG' },
      ref: { __rl: true, mode: 'name', value: 'main' }
    },
    credentials: { githubApi: newCredential('GitHub account') }
  },
  output: [{}]
});

const disparaCashupPqTool = tool({
  type: 'n8n-nodes-base.githubTool',
  version: 1.1,
  config: {
    name: 'disparar_relatorio_cashup_pq',
    parameters: {
      resource: 'workflow',
      operation: 'dispatch',
      authentication: 'accessToken',
      owner: { __rl: true, mode: 'name', value: 'baianomiranda-collab' },
      repository: { __rl: true, mode: 'name', value: 'claude' },
      workflowId: { __rl: true, mode: 'list', value: 342977973, cachedResultName: 'Relatorio Orcamentos Cash-UP PQ' },
      ref: { __rl: true, mode: 'name', value: 'main' }
    },
    credentials: { githubApi: newCredential('GitHub account') }
  },
  output: [{}]
});

const aiAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AI Agent',
    parameters: {
      promptType: 'define',
      text: expr("{{ $('Simplificando Dados').item.json.Mensagem }}"),
      options: {
        systemMessage: expr("# ORGANON — Agente de Gestão de Projetos e Técnico Especialista.\n\nVocê é o **ORGANON**, assistente digital sênior da **B4 Soluções** — empresa de consultoria em TI com sede em Recife/PE, especializada em ERP Pirâmide (Oracle), ERP Protheus (SQL Server) e no sistema proprietário ORGANON (MySQL).\n\nVocê atua como colaborador multifuncional da B4, assumindo automaticamente o papel mais adequado a cada solicitação:\n\n| Modo | Quando ativa |\n|---|---|\n| 🗂️ **Gestor de Projetos** | Registrar, consultar, atualizar, concluir suas atividades |\n| 🔍 **Consultor de novas TES** | Auxiliar a encontrar a TES correta no ERP Protheus |\n| 🛠️ **Especialista Técnico** | ERP Pirâmide, ERP Protheus, ORGANON, Scriptcase, PHP, Oracle, SQL Server, MySQL, APIs |\n\n\nVocê é preciso, direto e proativo. Português brasileiro. Sem enrolação.\n\n---\n\n# CONTEXTO DA EMPRESA\n\n**Consultor principal:** Bruno Miranda  \n**Clientes ativos:**\n- **Grupo PQ**\n\n**Sistemas que a B4 trabalha:**\n- ERP Pirâmide → banco Oracle\n- ERP Protheus → banco SQL Server  \n- ORGANON (sistema próprio) → banco MySQL\n\n---\n\n# MÓDULO 1 — GESTOR DE PROJETOS (Supabase)\n\n## Tabela `PROJETOS`\n\n| Coluna | Tipo | Descrição |\n|---|---|---|\n| `id` | integer (PK, auto) | Identificador único |\n| `created_at` | timestamp | Criação automática |\n| `projeto` | text | Nome do projeto |\n| `setor` | text | Setor responsável |\n| `tarefas` | text | Nome da tarefa |\n| `classificacao` | text | Tipo da tarefa |\n| `inicio` | timestamp | Início da tarefa |\n| `previsao` | timestamp | Previsão de conclusão |\n| `conclusao` | timestamp | Conclusão real (NULL = em aberto) |\n| `consultor` | text | Executor |\n| `responsavel` | text | Responsável gerencial |\n| `gestor` | text | Gestor supervisor |\n| `criticidade` | text | Baixa / Média / Alta / Crítica |\n| `prioridade` | integer | 1 = mais urgente |\n| `andamento` | integer | 0 a 100 (%) |\n| `empresa` | text | Empresa vinculada |\n\n## Operações disponíveis\n- **REGISTRAR** — coleta dados obrigatórios e insere (confirma antes)\n- **ATUALIZAR** — qualquer campo pelo `id` (confirma antes)\n- **CONCLUIR** — seta `conclusao = agora` e `andamento = 100`\n- **DELETAR** — remove pelo `id` (exige confirmação explícita)\n- **CONSULTAR** — busca com filtros, calcula métricas, gera relatório\n\n## Status automático\n\n## Indicadores que você calcula\n- Dias restantes / dias de atraso\n- % médio por projeto, setor, empresa, consultor\n- Tarefas com andamento < 50% e prazo em menos de 3 dias\n\n## Regras\n1. Nunca assuma dados — pergunte o que faltar\n2. Confirme todos os dados antes de qualquer escrita\n3. DELETE exige confirmação explícita com o `id` e o usuario deve se identificar como \"Bruno Miranda\"\n4. Ao atingir andamento 100%, pergunte se registra conclusão\n5. Se retornar > 20 registros, ofereça filtro antes de exibir tudo\n\n---\n\n# MÓDULO 2 — CONSULTOR DE NOVAS TES (ERP PRotheus)\n\nQuando o usuário perguntar sobre TES (Tipo de Entrada e Saída):\n- Confirme o que está sendo buscado (operação, natureza fiscal, CFOP pretendido)\n- Oriente sobre a TES mais adequada ao contexto\n- Se necessário, peça mais informações (UF, tipo de produto, regime tributário)\n- Nunca invente códigos — se não tiver certeza, informe e sugira validação no ERP\n\n---\n\n# MÓDULO 3 — ESPECIALISTA TÉCNICO\n\nQuando o usuário trouxer um problema técnico, código ou nova funcionalidade:\n\n**Ao receber código:**\n1. Analise lógica, performance e segurança\n2. Identifique problemas claramente\n3. Entregue versão corrigida/otimizada\n4. Explique o que foi ajustado (de forma concisa)\n\n**Ao receber pedido de nova funcionalidade:**\n1. Entenda o objetivo real\n2. Sugira a melhor abordagem\n3. Entregue: estrutura + código completo + onde aplicar no Scriptcase\n\n**Padrões que você sempre segue:**\n- SQL limpo, sem consultas desnecessariamente pesadas\n- Sem duplicidade de código\n- Validação de dados de entrada sempre\n- Atenção a SQL Injection e XSS\n- Pense em performance com grandes volumes (contexto Oracle/ERP)\n- Vá além do pedido: aponte melhorias que o usuário talvez não percebeu\n\n**Stack prioritária:** Scriptcase · PHP · Oracle SQL/PL-SQL · SQL Server T-SQL · MySQL · JavaScript · HTML/CSS · Python · n8n\n\n---\n\n# MÓDULO 4 — DISPARO DE RELATÓRIOS CASH-UP (GitHub Actions)\n\nAlém do agendamento diário automático que já existe, você tem duas ferramentas para disparar manualmente a geração e o envio do relatório de orçamentos do Cash-UP:\n\n- `disparar_relatorio_cashup_pg` — dispara o relatório da **PG Química** (portal cashup-pgquimica.com.br)\n- `disparar_relatorio_cashup_pq` — dispara o relatório da **Pernambuco Química / Grupo PQ** (portal cashup-pernambucoquimica.com.br)\n\n**Regras:**\n1. **Sempre confirme com o usuário qual dos dois (PG ou PQ) antes de disparar** — nunca dispare sem deixar claro qual portal está sendo acionado.\n2. Se o usuário disser só \"manda o relatório\" sem especificar qual, pergunte PG ou PQ antes de agir.\n3. Depois de disparar, avise que o processo é assíncrono e leva de alguns minutos até ~25 minutos até o relatório chegar por email nos destinatários configurados — não há retorno imediato de sucesso ou falha por aqui.\n\n---\n\n## REGRAS DE COMPORTAMENTO\n\n1. **Antes de qualquer operação de escrita (INSERT, UPDATE, DELETE)**, confirme com o usuário os dados que serão gravados.\n2. **Nunca assuma dados** — se faltarem informações obrigatórias, pergunte antes de executar.\n3. **Para deleções**, sempre solicite uma confirmação explícita com o `id` do registro.\n4. **Ao atualizar `andamento` para 100%**, pergunte se deseja registrar a `conclusao` com a data/hora atual.\n5. **Ao registrar `conclusao`**, verifique se o campo `andamento` está em 100 e atualize se necessário.\n6. **Calcule e informe automaticamente**:\n   - Tarefas atrasadas (onde `previsao < hoje` e `conclusao` é NULL)\n   - Tarefas com andamento abaixo de 50% próximas do prazo (menos de 3 dias)\n   - Percentual médio de conclusão por projeto, setor ou empresa\n\n---\n\n## RESPOSTAS E RELATÓRIOS\n\nAo consultar tarefas, apresente sempre em formato de tabela organizada com as colunas mais relevantes para o contexto da consulta.\n\n### Indicadores que você calcula automaticamente:\n- **Status**: `✅ Concluído` | `🔄 Em andamento` | `⚠️ Atrasado` | `🔴 Crítico`\n- **Dias restantes**: diferença entre hoje e `previsao`\n- **Dias de atraso**: diferença entre hoje e `previsao` quando vencido e não concluído\n- **% médio de conclusão** por grupo (projeto / setor / empresa / consultor)\n\n### Lógica de Status:\n```\nSE conclusao IS NOT NULL → ✅ Concluído\nSE conclusao IS NULL E previsao >= hoje → 🔄 Em andamento\nSE conclusao IS NULL E previsao < hoje E andamento >= 50 → ⚠️ Atrasado\nSE conclusao IS NULL E previsao < hoje E andamento < 50 → 🔴 Crítico\n```\n\n---\n\n## EXEMPLOS DE INTERAÇÕES\n\n**Usuário:** \"Registra uma nova tarefa de conciliação bancária para a Lidiane no setor Contábil, empresa SYM MTZ, com previsão para 20/04/2026, prioridade 2, criticidade Alta.\"\n\n**ORGANON:** Confirma todos os dados antes de inserir e solicita os campos faltantes (`projeto`, `responsavel`, `gestor`, `classificacao`).\n\n---\n\n**Usuário:** \"Atualiza o andamento da tarefa 8 para 75%\"\n\n**ORGANON:** Executa o UPDATE e confirma: \"Tarefa ID 8 atualizada. Andamento: 75%. Deseja registrar alguma observação ou alterar a previsão de conclusão?\"\n\n---\n\n**Usuário:** \"Me dá um relatório de todas as tarefas atrasadas\"\n\n**ORGANON:** Consulta todos os registros onde `previsao < hoje` e `conclusao IS NULL`, organiza por criticidade e apresenta tabela com: ID, Projeto, Tarefa, Consultor, Previsão, Dias de Atraso, Andamento, Status.\n\n---\n\n**Usuário:** \"Qual o andamento geral do projeto Fechamento Contábil?\"\n\n**ORGANON:** Calcula a média de `andamento` de todos os registros do projeto, informa quantas tarefas estão concluídas, em andamento e atrasadas, e exibe o percentual consolidado.\n\n---\n\n## LINGUAGEM E TOM\n\n- Português brasileiro, tom profissional e direto\n- Use emojis de status apenas nos relatórios (✅ ⚠️ 🔴 🔄)\n- Seja proativo: ao reportar dados, sempre destaque pontos de atenção\n- Ao concluir uma operação, confirme o que foi feito de forma resumida\n\n---\n\n## RESTRIÇÕES\n\n- Nunca invente ou assuma dados que não foram fornecidos pelo usuário ou pela base\n- Nunca execute DELETE sem confirmação explícita\n- Nunca altere o campo `id` ou `created_at` de registros existentes\n- Se a consulta retornar muitos registros (> 20), pergunte se o usuário deseja filtrar antes de exibir tudo")
      }
    },
    subnodes: {
      model: anthropicChatModel,
      memory: postgresChatMemory,
      tools: [desativarAgenteTool, criarProjetoTool, atualizaProjetoTool, pesquisarProjetoTool, disparaCashupPgTool, disparaCashupPqTool]
    }
  },
  output: [{ output: 'Claro! Como posso te ajudar hoje?' }]
});

// ============================================================
// HUMANIZAR RESPOSTA (quebra e envia mensagens em loop)
// ============================================================

const anthropicChatModel1 = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Anthropic Chat Model1',
    parameters: { model: { __rl: true, mode: 'list', value: 'claude-haiku-4-5-20251001', cachedResultName: 'Claude Haiku 4.5' }, options: {} },
    credentials: { anthropicApi: newCredential('Anthropic account') }
  }
});

const structuredOutputParser1 = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Structured Output Parser1',
    parameters: { schemaType: 'manual', inputSchema: '{\n  "type": "object",\n  "properties": {\n    "mensagens": {\n      "type": "array",\n      "items": {\n        "type": "string"\n      }\n    }\n  },\n  "required": ["mensagens"],\n  "additionalProperties": false\n}' }
  }
});

const autoFixingOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
  version: 1,
  config: {
    name: 'Auto-fixing Output Parser',
    parameters: { options: {} },
    subnodes: { model: anthropicChatModel1, outputParser: structuredOutputParser1 }
  }
});

const basicLlmChain = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Basic LLM Chain',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.output }}'),
      hasOutputParser: true,
      messages: { messageValues: [{ message: "Apenas estruture a <mensagem_do_usuario> no formato JSON solicitado no output parser e seguindo as instruções de formatação abaixo. Não altere nada mais na mensagem\n\n# Formatação\n- Divida as mensagens para que fiquem naturais e humanizadas;\n- Divida as mensagens conforme estrutura do output parser para que não fiquem muito longas (maiores que 240 caractéres);\n- Não separe mensagens vazias;\n- Use quebras de linhas (\\n\\n) após pontos finais;\n- Para negrito (bold) use apenas um '' nunca duas '' (exemplo: *negrito).\n\nExemplo de formato JSON:\n{\n\"mensagens\": [\"Mensagem 0\", \"Mensagem 1\", \"Mensagem 2\"]\n}" }] },
      batching: {}
    },
    subnodes: { model: anthropicChatModel1, outputParser: autoFixingOutputParser }
  },
  output: [{ output: { mensagens: ['Claro!', 'Como posso te ajudar hoje?'] } }]
});

const splitOut = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Split Out', parameters: { fieldToSplitOut: 'output.mensagens', options: {} } },
  output: [{ 'output.mensagens': 'Claro! Como posso te ajudar hoje?' }]
});

const loopOverItems = splitInBatches({ version: 3, config: { name: 'Loop Over Items', parameters: {} } });

const noOpLoopDone = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing2', parameters: {} }, output: [{}] });

const httpRequestEnvia = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'HTTP Request',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{\n{ \"messageData\":\n{ \"to\": $('Unificando').item.json.whatsapp,\n\"text\": $json['output.mensagens'] } } }}"),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{}]
});

const wait1 = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait1', parameters: { resume: 'timeInterval', amount: expr("{{ $('Central de Controle').item.json.espera_buffer }}") } },
  output: [{}]
});

// ============================================================
// SUPABASE (ferramentas orfas — leftover de template, nao conectadas)
// ============================================================

const buscarProdutos = node({
  type: 'n8n-nodes-base.supabaseTool',
  version: 1,
  config: {
    name: 'buscar_produtos',
    parameters: { resource: 'row', operation: 'getAll', descriptionType: 'manual', toolDescription: 'Busca os produtos no Supabase', tableId: 'Produtos', returnAll: true },
    credentials: { supabaseApi: newCredential('Supabase account') }
  },
  output: [{}]
});

const buscarPedidos = node({
  type: 'n8n-nodes-base.supabaseTool',
  version: 1,
  config: {
    name: 'buscar_pedidos',
    parameters: { resource: 'row', operation: 'getAll', descriptionType: 'manual', toolDescription: 'Busca informações dos pedidos no Supabase', tableId: 'Pedidos', returnAll: true },
    credentials: { supabaseApi: newCredential('Supabase account') }
  },
  output: [{}]
});

const criarPedido = node({
  type: 'n8n-nodes-base.supabaseTool',
  version: 1,
  config: {
    name: 'criar_pedido',
    parameters: {
      resource: 'row',
      operation: 'create',
      descriptionType: 'manual',
      toolDescription: 'Cria um novo pedido no Supabase',
      tableId: 'Pedidos',
      fieldsUi: { fieldValues: [
        { fieldId: 'lead_id', fieldValue: expr("{{ $fromAI('fieldValues0_Field_Value', 'id do lead na tabela Leads do Supabase', 'string') }}") },
        { fieldId: 'produto_id', fieldValue: expr("{{ $fromAI('fieldValues1_Field_Value', 'id do produto na tabela Produtos do Supabase', 'string') }}") },
        { fieldId: 'status', fieldValue: expr("{{ $fromAI('fieldValues2_Field_Value', 'Status do pedido: aguardando_pagamento, pago, cancelado', 'string') }}") }
      ] }
    },
    credentials: { supabaseApi: newCredential('Supabase account') }
  },
  output: [{}]
});

const atualizarPedido = node({
  type: 'n8n-nodes-base.supabaseTool',
  version: 1,
  config: {
    name: 'atualizar_pedido',
    parameters: {
      resource: 'row',
      operation: 'update',
      descriptionType: 'manual',
      toolDescription: 'Atualiza um pedido no Supabase',
      tableId: 'Pedidos',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr("{{ $fromAI('conditions0_Field_Value', 'Id do pedido', 'string') }}") }] },
      fieldsUi: { fieldValues: [
        { fieldId: 'status', fieldValue: expr("{{ $fromAI('fieldValues0_Field_Value', 'Status do pedido: aguardando_pagamento, pago, cancelado', 'string') }}") },
        { fieldId: 'asaas_link_pagamento', fieldValue: expr("{{ $fromAI('fieldValues1_Field_Value', 'URL de pagamento do Asaas', 'string') }}") },
        { fieldId: 'asaas_payment_id', fieldValue: expr("{{ $fromAI('fieldValues2_Field_Value', 'Id do cliente no Asaas', 'string') }}") }
      ] }
    },
    credentials: { supabaseApi: newCredential('Supabase account') }
  },
  output: [{}]
});

// ============================================================
// ILHAS ORFAS (desconectadas do fluxo principal - leftovers)
// ============================================================

const megaApiOrphan = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'MEGA API',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{ \n{ \"messageData\": \n     { \"to\": $(\"Unificando\").item.json.whatsapp, \n\"text\": $json.output } } }}"),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{}]
});

const noOpMegaApi = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing', parameters: {} }, output: [{}] });

const editFields8 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields8', parameters: { mode: 'manual', assignments: { assignments: [{ id: '4a5140ad-9cd4-40fb-8c0c-89fee66fd829', name: 'output', value: expr("{{ $json.output.split('\\n\\n') }}"), type: 'array' }] }, options: {} } },
  output: [{ output: ['mensagem 1', 'mensagem 2'] }]
});

const splitOut1 = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: { name: 'Split Out1', parameters: { fieldToSplitOut: 'output', options: {} } },
  output: [{ output: 'mensagem 1' }]
});

const loopOverItems1 = splitInBatches({ version: 3, config: { name: 'Loop Over Items1', parameters: {} } });

const noOpLoop1Done = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'No Operation, do nothing5', parameters: {} }, output: [{}] });

const httpRequest1Orphan = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'HTTP Request1',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{\n{ \"messageData\":\n{ \"to\": $('Unificando').item.json.whatsapp,\n\"text\": $json.output } } }}"),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{}]
});

const wait3Orphan = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait3', parameters: { resume: 'timeInterval', amount: 2 } },
  output: [{}]
});

const editFields9 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Edit Fields9',
    parameters: { mode: 'manual', assignments: { assignments: [
      { id: '1466f032-5c27-483c-8741-db5f400c50b4', name: 'Excel', value: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.url }}"), type: 'string' },
      { id: 'dc62ccb7-4c3a-4ed5-9d93-86ee41db44c6', name: 'pdf_caption', value: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.caption }}"), type: 'string' }
    ] }, options: {} }
  },
  output: [{ Excel: 'https://example.com/doc.enc', pdf_caption: 'Segue a planilha' }]
});

const downloadMediaDocument1 = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'downloadMediaMessage document1',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/instance/downloadMediaMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{\n    "messageKeys": {\n        "mediaKey": "{{ $(\'Webhook\').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mediaKey }}",\n        "directPath": "{{ $(\'Webhook\').item.json.body.message.documentWithCaptionMessage.message.documentMessage.directPath }}",\n        "url": "{{ $json.pdf }}",\n        "mimetype": "{{ $(\'Webhook\').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mimetype }}",\n        "messageType": "document"\n    }\n}'),
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') }
  },
  output: [{ data: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,AAAA' }]
});

const editFields10 = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Edit Fields10', parameters: { mode: 'manual', assignments: { assignments: [{ id: '0c725732-8ed0-4e32-9644-cb0126b652d3', name: 'data', value: expr("{{ $json.data.split(',') [1]}}"), type: 'string' }] }, options: {} } },
  output: [{ data: 'AAAA' }]
});

const convertToFile3 = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: { name: 'Convert to File3', parameters: { operation: 'toBinary', sourceProperty: 'data', options: { mimeType: expr("{{ $('Webhook').item.json.body.message.documentWithCaptionMessage.message.documentMessage.mimetype }}") } } },
  output: [{}]
});

const extractFromFile1 = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extract from File1', parameters: { operation: 'xlsx', options: {} } },
  output: [{ text: 'Texto extraído do Excel' }]
});

const redis9 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis9',
    parameters: {
      operation: 'push',
      list: expr("{{ $('Dados Lead').item.json.IdConversa }}_buffer"),
      messageData: expr("<ContextoPDF>\n  <TranscricaoPDF>\n{{ $json.text }}\n  </TranscricaoPDF>\nContexto Extra: O usuário encaminhou a mensagem a seguir junto ao PDF.\n  <MensagemUsuario>\n{{ $('Edit Fields9').item.json.pdf_caption }}\n  </MensagemUsuario>\n</ContextoPDF>\n"),
      tail: true
    },
    credentials: { redis: newCredential('Redis account') }
  },
  output: [{}]
});

// ============================================================
// STICKY NOTES (documentacao visual do canvas original)
// ============================================================

const stickyGatilho = sticky('# Gatilho', [], { color: 4 });
const stickyRespondendoWhatsapp = sticky('# Respondendo Whatsapp', [], { color: 3 });
const stickyAgenteIA = sticky('# Agente de IA', [], { color: 4 });
const stickyGestaoUsuarios = sticky('# Gestão de Usuários e Conversas', [], { color: 3 });
const stickyFiltrosIniciais = sticky('## Filtros Iniciais\nPara evitar que fluxo seja executado quando não queremos', [], { color: 5 });
const stickyDadosLead = sticky('## Dados do Lead\nInformações principais sobre o lead', [], { color: 5 });
const stickyCentralControle = sticky('## Central de Controle\nAlguns parametros passados para o Wait e Agente', [], { color: 2 });
const stickyAjusteSet = sticky('Ajuste o Node Set com os campos relevantes fornecidos.\n', [], { color: 4 });
const stickyAjusteFiltros = sticky('Ajustes os filtros necessários conforme seu gatilho de entrada', [], { color: 4 });
const stickyTratamentoTexto = sticky('## Tratamento para mensagens de texto', [], { color: 4 });
const stickyTratamentoAudio = sticky('## Tratamento para mensagens audio', [], { color: 4 });
const stickyTratamentoImagem = sticky('## Tratamento para mensagens de imagens', [], { color: 4 });
const stickyTratamentoPDF = sticky('## Tratamento para mensagens documentos PDF', [], { color: 4 });
const stickyTratamentoExcel = sticky('## Tratamento para mensagens documentos Excel', [], { color: 4 });
const stickyTratamentoOutro = sticky('## Tratamento quando nenhum acima for acionado', [], { color: 4 });
const stickyGestaoDesativando = sticky('## Gestão do fluxo do Agente Desativando', [], { color: 4 });
const stickyEnvioRespostas1 = sticky('## Envio das Respostas ao Usuário\nEnvio das mensagens quebradas para o usuário', [], { color: 5 });
const stickyEnvioRespostas2 = sticky('## Envio das Respostas ao Usuário\nEnvio das mensagens quebradas para o usuário', [], { color: 5 });
const stickyHumanizar1 = sticky('## Humanizar Resposta 2 Alternativa\nQuebra de mensagens em mensagens menores e com contexto.', [], { color: 5 });
const stickyHumanizar2 = sticky('## Humanizar Resposta 2 Alternativa\nQuebra de mensagens em mensagens menores e com contexto.', [], { color: 5 });
const stickyZApi = sticky('Ajuste sua instância e autenficiação da Z-API', [], { color: 3 });
const stickySupabase = sticky('## SUPABASE\n', [], {});
const stickyMysql = sticky('## MYSQL\n', [], {});

// ============================================================
// MONTAGEM DO WORKFLOW
// ============================================================

export default workflow('agente-organon-v1', 'AGENTE ORGANON V1')
  .add(webhook)
  .to(centralDeControle)
  .to(filtroInicial1)
  .to(dadosLead)
  .to(eIntervencaoHumana
    .onTrue(desativaAgente.to(chatMemoryManager.to(noOpAfterDesativa)))
    .onFalse(redis7.to(botDesativado
      .onTrue(chatMemoryManager1.to(noOpAfterDesativado))
      .onFalse(switchTipoMensagem
        .onCase(0, mensagem1.to(redis.to(redisBuffer1)))
        .onCase(1, editFields2.to(downloadMediaAudio.to(editFields3.to(convertToFile.to(transcribeRecording.to(redis3.to(redisBuffer1)))))))
        .onCase(2, editFields5.to(downloadMediaImagem.to(editFields4.to(convertToFile1.to(analyzeImage.to(redis4.to(redisBuffer1)))))))
        .onCase(3, editFields6.to(downloadMediaDocument.to(editFields7.to(convertToFile2.to(extractFromFile.to(redis5.to(redisBuffer1)))))))
        .onCase(4, editFields1.to(redis2.to(redisBuffer1)))
      ))))
  .add(redisBuffer1)
  .to(wait)
  .to(redisBuffer2)
  .to(ifBufferEstavel
    .onTrue(redis1.to(editFields.to(filter.to(simplificandoDados.to(procuraUsuario.to(usuarioExiste
      .onTrue(unificando.input(0))
      .onFalse(criarUsuario.to(unificando.input(1)))
    ))))))
    .onFalse(noOpBufferInstavel))
  .add(unificando)
  .to(editFields11)
  .to(codeInJavaScript)
  .to(if1TES
    .onTrue(httpRequest2.to(noOpAposTES))
    .onFalse(aiAgent))
  .add(aiAgent)
  .to(basicLlmChain)
  .to(splitOut)
  .to(loopOverItems
    .onDone(noOpLoopDone)
    .onEachBatch(httpRequestEnvia.to(wait1.to(nextBatch(loopOverItems))))
  )
  .add(megaApiOrphan)
  .to(noOpMegaApi)
  .add(editFields8)
  .to(splitOut1)
  .to(loopOverItems1
    .onDone(noOpLoop1Done)
    .onEachBatch(httpRequest1Orphan.to(wait3Orphan.to(nextBatch(loopOverItems1))))
  )
  .add(editFields9)
  .to(downloadMediaDocument1)
  .to(editFields10)
  .to(convertToFile3)
  .to(extractFromFile1)
  .to(redis9)
  .add(buscarProdutos)
  .add(buscarPedidos)
  .add(criarPedido)
  .add(atualizarPedido)
  .add(stickyGatilho)
  .add(stickyRespondendoWhatsapp)
  .add(stickyAgenteIA)
  .add(stickyGestaoUsuarios)
  .add(stickyFiltrosIniciais)
  .add(stickyDadosLead)
  .add(stickyCentralControle)
  .add(stickyAjusteSet)
  .add(stickyAjusteFiltros)
  .add(stickyTratamentoTexto)
  .add(stickyTratamentoAudio)
  .add(stickyTratamentoImagem)
  .add(stickyTratamentoPDF)
  .add(stickyTratamentoExcel)
  .add(stickyTratamentoOutro)
  .add(stickyGestaoDesativando)
  .add(stickyEnvioRespostas1)
  .add(stickyEnvioRespostas2)
  .add(stickyHumanizar1)
  .add(stickyHumanizar2)
  .add(stickyZApi)
  .add(stickySupabase)
  .add(stickyMysql);
