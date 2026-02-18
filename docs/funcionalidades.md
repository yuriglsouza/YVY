# Relatório Completo de Funcionalidades - SYAZ Orbital

Este documento descreve todas as funcionalidades atuais do sistema de monitoramento agronômico **SYAZ Orbital**.

## 1. Visão Geral (Dashboard)
Painel central de comando ("Centro de Comando") para visão holística da operação.

- **KPIs Globais**: Exibição de métricas chave como Total de Fazendas, Área Monitorada (ha), Média Hídrica e Alertas Críticos.
- **Gráfico de Saúde (NDVI)**: Visualização comparativa do vigor vegetativo de todas as unidades monitoradas.
- **Alertas Prioritários**: Lista automática de fazendas que requerem atenção imediata (status "Crítico" ou "Atenção").
- **Previsão de Produtividade**: Gráfico de tendência preditiva para a safra (baseado em dados agregados).

## 2. Gestão de Fazendas
Módulo dedicado ao cadastro e administração das propriedades rurais.

- **Listagem de Fazendas**: Visualização em cartões com resumo de status e localização.
- **Cadastro de Novas Unidades**: Interface para adicionar novas fazendas com nome, coordenadas geográficas e cultura.
- **Navegação**: Acesso direto aos detalhes de cada unidade.

## 3. Monitoramento Detalhado (Detalhes da Fazenda)
O núcleo da inteligência agronômica, oferecendo dados profundos para cada propriedade.

### Meteorologia e Localização
- **Clima em Tempo Real**: Temperatura, umidade, vento e precipitação atualizados.
- **Mapa Interativo**:
    - **Camada de Satélite (RGB)**: Imagens reais de alta resolução.
    - **Camada Térmica (LST)**: Mapa de calor para identificar estresse térmico/hídrico.
    - **Zonas de Manejo**: Geração automática de zonas de produtividade (Alta, Média, Baixa).

### Análise Espectral (Índices de Vegetação)
Gráficos históricos e atuais dos principais índices agronômicos:
- **NDVI (Vigor)**: Saúde geral da planta.
- **NDWI (Água)**: Estresse hídrico na vegetação.
- **NDRE (Clorofila/Nitrogênio)**: Detecção precoce de deficiências.
- **LST (Temperatura da Superfície)**: Monitoramento térmico do solo/dossel.

### Inteligência Artificial (IA)
Módulo de análise avançada alimentado por IA Generativa.
- **Diagnóstico Técnico**: Análise textual automática das condições atuais da lavoura.
- **Previsão de Cenário**: Projeção de tendências futuras baseadas no histórico.
- **Recomendações Agronômicas**: Sugestões práticas de manejo geradas pela IA.

### Ferramentas de Apoio à Decisão
- **Benchmark Regional**: Comparação da performance da fazenda com a média da região vizinha.
- **Análise Financeira (ROI)**: Estimativa de lucratividade baseada em zonas de manejo, custos e preço de venda.

## 4. Relatórios e Exportação
- **Geração de PDF Técnico**: Criação instantânea de relatórios em PDF com:
    - Cabeçalho profissional.
    - Diagnóstico completo da IA.
    - Tabelas de índices atuais.
    - Gráficos de evolução (últimos 30 dias).
    - Análise financeira (ROI e Lucro Líquido).
    - Mapas das zonas de manejo.

## 5. Gestão de Clientes (CRM)
Módulo para relacionamento com produtores e empresas.
- **Cadastro de Clientes**: Gestão de dados de contato (Nome, Email, Telefone, Empresa).
- **Associação**: Vínculo entre clientes e fazendas (estrutura preparada).
- **Edição e Exclusão**: Gestão completa do ciclo de vida do cliente.

## 6. Configurações e Sistema
Controle de preferências e monitoramento da saúde da plataforma.
- **Perfil de Usuário**: Gestão de email para contato.
- **Alertas e Notificações**: Configuração para recebimento de alertas críticos por email.
- **Status do Sistema**: Monitoramento em tempo real da conexão com serviços críticos (Google Earth Engine, Serviço de Email).

## 7. Segurança e Acesso
- **Autenticação**: Sistema de login seguro para proteção dos dados agronômicos.
