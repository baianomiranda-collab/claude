import { workflow, node, trigger, sticky, newCredential } from '@n8n/workflow-sdk';

const agendamentoPG = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Agendamento PG - 18h07',
    parameters: {
      rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 18, triggerAtMinute: 7 }] }
    },
    position: [240, 200]
  },
  output: [{}]
});

const dispararPG = node({
  type: 'n8n-nodes-base.github',
  version: 1.1,
  config: {
    name: 'Disparar Cash-UP PG',
    parameters: {
      resource: 'workflow',
      operation: 'dispatch',
      authentication: 'accessToken',
      owner: { __rl: true, mode: 'name', value: 'baianomiranda-collab' },
      repository: { __rl: true, mode: 'name', value: 'claude' },
      workflowId: { __rl: true, mode: 'list', value: 342977972, cachedResultName: 'Relatorio Orcamentos Cash-UP PG' },
      ref: { __rl: true, mode: 'name', value: 'main' }
    },
    credentials: { githubApi: newCredential('GitHub account') },
    position: [540, 200]
  },
  output: [{}]
});

const dispararPQ = node({
  type: 'n8n-nodes-base.github',
  version: 1.1,
  config: {
    name: 'Disparar Cash-UP PQ',
    parameters: {
      resource: 'workflow',
      operation: 'dispatch',
      authentication: 'accessToken',
      owner: { __rl: true, mode: 'name', value: 'baianomiranda-collab' },
      repository: { __rl: true, mode: 'name', value: 'claude' },
      workflowId: { __rl: true, mode: 'list', value: 342977973, cachedResultName: 'Relatorio Orcamentos Cash-UP PQ' },
      ref: { __rl: true, mode: 'name', value: 'main' }
    },
    credentials: { githubApi: newCredential('GitHub account') },
    position: [540, 400]
  },
  output: [{}]
});

const avisarWhatsAppPG = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Avisar WhatsApp - PG Iniciando',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: {
        messageData: {
          to: '5581998082828',
          text: '🔄 *Cash-UP PG*\nDisparado agora (18h07) via n8n.\nAcompanhar: https://github.com/baianomiranda-collab/claude/actions/workflows/relatorio-cashup-pg.yml'
        }
      }
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') },
    position: [840, 200]
  },
  output: [{ messageId: 'abc123' }]
});

const avisarWhatsAppPQ = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Avisar WhatsApp - PQ Iniciando',
    parameters: {
      method: 'POST',
      url: 'https://apinocode01.megaapi.com.br/rest/sendMessage/megacode-M8WFF7YG9U9BDPT6GQ3D7LBWGAV/text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: {
        messageData: {
          to: '5581998082828',
          text: '🔄 *Cash-UP PQ*\nDisparado agora via n8n (logo apos a PG terminar).\nAcompanhar: https://github.com/baianomiranda-collab/claude/actions/workflows/relatorio-cashup-pq.yml'
        }
      }
    },
    credentials: { httpBearerAuth: newCredential('MegaAPI Organon') },
    position: [840, 400]
  },
  output: [{ messageId: 'abc123' }]
});

const recebeResultadoPG = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Recebe resultado PG',
    parameters: {
      httpMethod: 'POST',
      path: 'cashup-pg-resultado-x9k2m7qz',
      responseMode: 'onReceived',
      options: { noResponseBody: true }
    },
    position: [240, 400]
  },
  output: [{ body: { projeto: 'PG', conclusion: 'success' } }]
});

const notaExplicativa = sticky(
  '## Dispara os workflows do Cash-UP (PG e PQ) no GitHub Actions\n\nO `schedule:` nativo do GitHub Actions pode atrasar horas em dias de pouca atividade. A PG dispara por horario fixo (18h07 Brasilia). Quando o job da PG termina no GitHub Actions (sucesso OU falha), ele chama o webhook \'Recebe resultado PG\' -- que dispara a PQ em seguida. A PQ nao tem mais horario fixo proprio: ela sempre roda logo depois que a PG terminar, nunca em paralelo. Pedido do Bruno em 29/08/2026.',
  [],
  { color: 4, width: 600, height: 400, position: [190, 150] }
);

export default workflow('cashup-pg-pq', 'Disparo Cash-UP PG/PQ (GitHub Actions)')
  .add(agendamentoPG)
  .to(dispararPG)
  .to(avisarWhatsAppPG)
  .add(recebeResultadoPG)
  .to(dispararPQ)
  .to(avisarWhatsAppPQ)
  .add(notaExplicativa);
