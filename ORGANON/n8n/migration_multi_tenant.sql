-- Multi-tenant AGENTE ORGANON V1 — rodar no MESMO banco MySQL "organon"
-- já usado pela tabela `projeto` (buscar_tarefas/criar_tarefas/atualizar_tarefas).

CREATE TABLE IF NOT EXISTS organon_clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,              -- "Grupo PQ", "Copergas", "Vereda"
  whatsapp_humano VARCHAR(20) NULL,        -- número p/ handoff humano deste cliente (com DDI, só dígitos)
  ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS organon_usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telefone VARCHAR(20) NOT NULL UNIQUE,    -- número WhatsApp de quem conversa, só dígitos com DDI
                                            -- (mesmo formato de senderPn: ex. 5581999999999)
  nome VARCHAR(120) NULL,
  cliente_id INT NOT NULL,
  codfilial VARCHAR(100) NULL,             -- CODFILIAL da tabela `projeto` que este usuário enxerga.
                                            -- NULL só é seguro para perfil='admin' (ver caveat abaixo).
  perfil VARCHAR(30) NOT NULL DEFAULT 'padrao',  -- ex: admin, padrao, somente_consulta
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES organon_clientes(id),
  INDEX idx_telefone (telefone)
);

-- Exemplo de onboarding de um cliente novo (ajuste os valores reais antes de rodar):
-- INSERT INTO organon_clientes (nome, whatsapp_humano) VALUES ('Grupo PQ', '5581980000000');
-- INSERT INTO organon_usuarios (telefone, nome, cliente_id, codfilial, perfil)
--   VALUES ('5581999999999', 'Fulano da Silva', 1, '020101', 'padrao');
