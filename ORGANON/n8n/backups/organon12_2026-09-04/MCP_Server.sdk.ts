import { workflow, trigger, tool, sticky, fromAi, expr } from '@n8n/workflow-sdk';

const getEventTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Get event',
    parameters: {
      resource: 'event',
      operation: 'get',
      descriptionType: 'manual',
      toolDescription: expr('Use essa ferramenta para encontrar um evento (consulta) específico\n\nFluxo Sugerido\n- Primeiramente execute o Get All Events para os próximos 7 dias, assim saberá todos os próximos eventos;\n- Busque o evento selecionado, para isso é necessário que o usuário informe o dia e horário;\n- Pelo horário dia e horário que usuário informou, encontre o evento, seu id e outros detalhes.\nImportante: Dia Atual {{ $now }}'),
      calendar: { __rl: true, mode: 'list', value: 'baianomiranda@gmail.com', cachedResultName: 'baianomiranda@gmail.com' },
      eventId: fromAi('Event_ID', 'id do evento', 'string'),
      options: {}
    }
  },
  output: [{ id: 'evt_123', summary: 'Reunião', status: 'confirmed' }]
});

const getAllEventsTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Get All events',
    parameters: {
      resource: 'event',
      operation: 'getAll',
      descriptionType: 'manual',
      toolDescription: expr('Use essa ferramenta para listar todos eventos\n\nFluxo Sugerido\n- Colete o periodo inicial e final. Se o usuário não falar, utilize a data de hoje mais 7 dias pra frente;\n- Execute Get All Events para o periodo selecionado.\n\nImportante: Dia Atual {{ $now }}'),
      calendar: { __rl: true, mode: 'list', value: 'baianomiranda@gmail.com', cachedResultName: 'baianomiranda@gmail.com' },
      timeMin: fromAi('After', '', 'string'),
      timeMax: fromAi('Before', '', 'string'),
      options: {}
    }
  },
  output: [{ id: 'evt_123', summary: 'Reunião', status: 'confirmed' }]
});

const createEventTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Create event',
    parameters: {
      resource: 'event',
      operation: 'create',
      descriptionType: 'manual',
      toolDescription: expr('Use essa ferramenta para criar um consulta no calendário.\n\nFluxo Sugerido:\n- Pergunte nome da pessoa, dia e horário desejado;\n- Chame Get All Events. Se não houver conflito de eventos, chame execute Create Event. Todos consultas possuem 1 hora e preencha campo "Summary" com [Nome da Pessoa];\n- Confirme para o usuário: "Seu agendamento foi realizado para [data/hora]."\n\nImportante: Dia Atual {{ $now }} '),
      calendar: { __rl: true, mode: 'list', value: 'baianomiranda@gmail.com', cachedResultName: 'baianomiranda@gmail.com' },
      start: fromAi('Start', 'id do evento', 'string'),
      end: fromAi('End', 'id do evento', 'string'),
      additionalFields: {
        summary: fromAi('Summary', 'id do evento', 'string')
      }
    }
  },
  output: [{ id: 'evt_123', summary: 'Reunião', status: 'confirmed' }]
});

const deleteEventTool = tool({
  type: 'n8n-nodes-base.googleCalendarTool',
  version: 1.3,
  config: {
    name: 'Delete event',
    parameters: {
      resource: 'event',
      operation: 'delete',
      descriptionType: 'manual',
      toolDescription: expr('Use essa ferramenta para deletar um evento específico\n\nFluxo Sugerido\n- Busque o evento selecionado, para isso é necessário que o usuário informe o dia e horário;\n- Primeiramente execute o Get All Events para os próximos 7 dias, assim saberá todos os próximos eventos;\n- Pelo horário dia e horário que usuário informou, encontre o evento, seu id e outros detalhes.\n- Delete esse evento com Delete Event.\n\nImportante: Dia Atual {{ $now }}'),
      calendar: { __rl: true, mode: 'list', value: 'baianomiranda@gmail.com', cachedResultName: 'baianomiranda@gmail.com' },
      eventId: fromAi('Event_ID', 'id do evento', 'string'),
      options: {}
    }
  },
  output: [{ success: true }]
});

const mcpServerTrigger = trigger({
  type: '@n8n/n8n-nodes-langchain.mcpTrigger',
  version: 2,
  config: {
    name: 'MCP Server Trigger',
    parameters: {
      authentication: 'none',
      path: 'mcp-calendar'
    },
    subnodes: { tools: [getEventTool, getAllEventsTool, createEventTool, deleteEventTool] }
  },
  output: [{}]
});

const note = sticky('## MCP Server', [mcpServerTrigger, getEventTool, getAllEventsTool, createEventTool, deleteEventTool], { color: 5 });

export default workflow('mcp-server', 'MCP Server')
  .add(mcpServerTrigger)
  .add(note);
