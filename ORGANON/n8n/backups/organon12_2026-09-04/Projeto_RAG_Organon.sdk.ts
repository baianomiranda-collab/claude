import { workflow, trigger, node, tool, switchCase, languageModel, memory, embeddings, embedding, vectorStore, documentLoader, textSplitter, newCredential, sticky, expr } from '@n8n/workflow-sdk';

const googleDriveTrigger = trigger({
  type: 'n8n-nodes-base.googleDriveTrigger',
  version: 1,
  config: {
    name: 'Google Drive Trigger',
    parameters: {
      pollTimes: { item: [{}] },
      triggerOn: 'specificFolder',
      folderToWatch: { __rl: true, mode: 'list', value: '1z7QO4NdqrKocj0ByDjjlmVDIs6fymx1i', cachedResultName: 'MATERIAIS CURSO RAG', cachedResultUrl: 'https://drive.google.com/drive/folders/1z7QO4NdqrKocj0ByDjjlmVDIs6fymx1i' },
      event: 'fileCreated',
      options: {}
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') }
  },
  output: [{ id: 'file_123', mimeType: 'application/pdf', name: 'documento.pdf', createdTime: '2026-09-04T12:00:00.000Z', owners: [{ displayName: 'Bruno Miranda' }] }]
});

const camposImportantes = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Campos Importantes',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'f6cd9efd-8b29-4695-8950-0de935c4ffe7', name: 'file_id', value: expr('{{ $json.id }}'), type: 'string' },
          { id: 'f6821952-ef58-43cf-9e56-db9ad65a372f', name: 'file_type', value: expr('{{ $json.mimeType }}'), type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ file_id: 'file_123', file_type: 'application/pdf' }]
});

const downloadFile = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download file',
    parameters: {
      resource: 'file',
      operation: 'download',
      fileId: { __rl: true, mode: 'id', value: expr('{{ $json.file_id }}') },
      options: {
        googleFileConversion: { conversion: { docsToFormat: 'text/plain' } }
      }
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') }
  },
  output: [{ file_id: 'file_123', file_type: 'application/pdf' }]
});

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract from File',
    parameters: { operation: 'pdf', options: {} }
  },
  output: [{ text: 'Conteúdo extraído do PDF...' }]
});

const textoSet = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Texto',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'be135270-e1cc-4c4b-854f-51a6146e418f', name: 'data', value: expr('{{ $json.text }}'), type: 'string' }
        ]
      },
      options: {}
    }
  },
  output: [{ data: 'Conteúdo extraído do PDF...' }]
});

const extractExcel = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extrair Excel',
    parameters: { operation: 'xlsx', options: {} }
  },
  output: [{ coluna1: 'valor1', coluna2: 'valor2' }]
});

const aggregateNode = node({
  type: 'n8n-nodes-base.aggregate',
  version: 1,
  config: {
    name: 'Aggregate',
    parameters: { aggregate: 'aggregateAllItemData', destinationFieldName: 'data', include: 'allFields', options: {} }
  },
  output: [{ data: [{ coluna1: 'valor1' }] }]
});

const summarizeNode = node({
  type: 'n8n-nodes-base.summarize',
  version: 1.1,
  config: {
    name: 'Summarize',
    parameters: {
      fieldsToSummarize: { values: [{ aggregation: 'concatenate', field: 'data' }] },
      options: {}
    }
  },
  output: [{ data: 'linha1,linha2' }]
});

const embeddingsOpenAiInsert = embeddings({
  type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  version: 1.2,
  config: {
    name: 'Embeddings OpenAI',
    parameters: { options: {} },
    credentials: { openAiApi: newCredential('n8n free OpenAI API credits') }
  }
});

const recursiveCharacterTextSplitter = textSplitter({
  type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter',
  version: 1,
  config: {
    name: 'Recursive Character Text Splitter',
    parameters: { chunkSize: 5000, options: {} }
  }
});

const defaultDataLoader = documentLoader({
  type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader',
  version: 1.1,
  config: {
    name: 'Default Data Loader',
    parameters: {
      textSplittingMode: 'custom',
      options: {
        splitPages: true,
        metadata: {
          metadataValues: [
            { name: 'file_id', value: expr("{{ $('Campos Importantes').item.json.file_id }}") },
            { name: 'file_type', value: expr("{{ $('Campos Importantes').item.json.file_type }}") },
            { name: 'Autor', value: expr("{{ $('Google Drive Trigger').item.json.owners[0].displayName }}") },
            { name: 'create_at', value: expr("{{ $('Google Drive Trigger').item.json.createdTime }}") }
          ]
        }
      }
    },
    subnodes: { textSplitter: recursiveCharacterTextSplitter }
  }
});

const supabaseVectorStoreInsert = vectorStore({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: {
    name: 'Supabase Vector Store',
    parameters: {
      mode: 'insert',
      tableName: { __rl: true, mode: 'list', value: 'documents', cachedResultName: 'documents' },
      options: { queryName: 'match_documents' }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    subnodes: { embedding: embeddingsOpenAiInsert, documentLoader: defaultDataLoader }
  }
});

const switchByFileType = switchCase({
  version: 3.4,
  config: {
    name: 'Switch',
    parameters: {
      rules: {
        values: [
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.file_type }}'), rightValue: 'application/pdf', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.file_type }}'), rightValue: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', operator: { type: 'string', operation: 'contains' } }],
              combinator: 'and'
            }
          }
        ]
      },
      options: {}
    }
  }
});

const chatTrigger = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: { name: 'When chat message received', parameters: {} },
  output: [{ chatInput: 'Quais serviços vocês oferecem?', sessionId: 'abc123' }]
});

const postgresChatMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  version: 1.4,
  config: {
    name: 'Postgres Chat Memory',
    parameters: {},
    credentials: { postgres: newCredential('Postgres account') }
  }
});

const anthropicModelAgent = languageModel({
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

const anthropicModelForTool = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.5,
  config: {
    name: 'Anthropic Chat Model',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'claude-haiku-4-5-20251001', cachedResultName: 'Claude Haiku 4.5' },
      options: {}
    },
    credentials: { anthropicApi: newCredential('Anthropic account') }
  }
});

const embeddingsOpenAiRetrieve = embedding({
  type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  version: 1.2,
  config: {
    name: 'Embeddings OpenAI1',
    parameters: { options: {} },
    credentials: { openAiApi: newCredential('n8n free OpenAI API credits') }
  }
});

const supabaseVectorStoreRetrieve = vectorStore({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: {
    name: 'Supabase Vector Store1',
    parameters: {
      mode: 'retrieve',
      tableName: { __rl: true, mode: 'list', value: 'documents', cachedResultName: 'documents' },
      options: { queryName: 'match_documents' }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    subnodes: { embedding: embeddingsOpenAiRetrieve }
  }
});

const vectorStoreServicosTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolVectorStore',
  version: 1.1,
  config: {
    name: 'Vector store - Serviços',
    parameters: { description: 'Use essa tool para coletar informações dos serviços do gestor de agente do IA' },
    subnodes: { vectorStore: supabaseVectorStoreRetrieve, model: anthropicModelForTool }
  },
  output: [{ result: 'Trecho relevante sobre os serviços...' }]
});

const aiAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AI Agent',
    parameters: {
      promptType: 'auto',
      options: {
        systemMessage: '## Instruções Gerais do Agente\n\nVocê é um especialista em serviços de IA, responsável por fornecer informações detalhadas e personalizadas sobre os serviços oferecidos por um Gestor de Agentes IA. \nSeu objetivo é esclarecer dúvidas e auxiliar potenciais clientes na escolha do serviço ideal para suas necessidades.\n\n## Público-Alvo\nSeu usuário é um potencial cliente, que pode ser um empresário, dono de startup, gestor de tecnologia ou qualquer profissional interessado em integrar agentes de IA em seus negócios.\n\n## Fontes de Informação\nPara responder às perguntas, você pode consultar um banco de dados vetorial para recuperar informações sobre tipos de serviços oferecidos, descrições, preços, prazos e integrações disponíveis.\n\n## Regras de Atendimento\n    1.    Seja claro e objetivo: Responda com linguagem acessível, evitando jargões técnicos desnecessários.\n    2.    Entenda a necessidade do cliente: Pergunte sobre o contexto do usuário antes de recomendar um serviço.\n    3.    Use o banco de dados vetorial: Caso precise de informações mais detalhadas, consulte o banco de dados antes de responder.\n    4.    Explique benefícios e diferenciais: Ao descrever um serviço, destaque como ele pode gerar valor para o cliente.\n    5.    Forneça próximos passos: Se o usuário demonstrar interesse, sugira um contato para mais informações ou orçamento.'
      }
    },
    subnodes: { model: anthropicModelAgent, memory: postgresChatMemory, tools: [vectorStoreServicosTool] }
  },
  output: [{ output: 'Oferecemos consultoria e implantação de agentes de IA...' }]
});

const openAiChatModelOrphan = node({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Chat Model1',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4.1-mini' },
      builtInTools: {},
      options: {}
    },
    credentials: { openAiApi: newCredential('n8n free OpenAI API credits') }
  },
  output: [{}]
});

const driveNote = sticky('## Arquivo Drive\n**Download do arquivo no drive', [], { color: 6 });
const vectorDbNote1 = sticky('## Banco de Dados Vetorial\n**Supabase', [], { color: 5 });
const agentNote = sticky('## Agente IA\n**Agente que responde com base nos docs', [], {});
const vectorDbNote2 = sticky('## Banco de Dados Vetorial\n**Supabase', [], { color: 4 });

export default workflow('projeto-rag-organon', 'Projeto RAG Organon')
  .add(googleDriveTrigger)
  .to(camposImportantes)
  .to(downloadFile)
  .to(switchByFileType
    .onCase(0, extractPdf.to(textoSet.to(supabaseVectorStoreInsert)))
    .onCase(1, extractExcel.to(aggregateNode.to(summarizeNode.to(supabaseVectorStoreInsert)))))
  .add(chatTrigger)
  .to(aiAgent)
  .add(openAiChatModelOrphan)
  .add(driveNote)
  .add(vectorDbNote1)
  .add(agentNote)
  .add(vectorDbNote2);
