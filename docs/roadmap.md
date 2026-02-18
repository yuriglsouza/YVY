# Roadmap de Funcionalidades Sugeridas - SYAZ Orbital

Este documento lista sugestões de features para evoluir o sistema, focando em trazer mais valor operacional e inteligência para o produtor e agrônomo.

## 1. Operação e Execução (Do Diagnóstico à Ação)
Hoje o sistema diz **o que** fazer (Recomendação IA). O próximo passo lógico é ajudar a **executar**.

- [ ] **Ordens de Serviço (OS)**: Transformar a recomendação da IA em uma tarefa digital para a equipe de campo (ex: "Aplicar Fungicida X no Talhão Norte").
- [ ] **Diário de Campo Digital**: App para o agrônomo registrar visitas, fotos georeferenciadas de pragas/doenças e anotações de voz que a IA transcreve e organiza.
- [ ] **Gestão de Estoque de Insumos**: Controle simples de entrada e saída de defensivos e sementes para calcular o custo real da lavoura automaticamente.

## 2. Mobilidade e Campo (PWA / Offline)
A internet no campo é instável.
- [ ] **Modo Offline (PWA)**: Permitir que o agrônomo baixe os mapas e dados da fazenda no Wi-Fi e leve para o campo sem sinal, sincronizando quando voltar.
- [ ] **Navegação GPS no Talhão**: Usar o GPS do celular para guiar o agrônomo exatamente até a zona de "baixa produtividade" identificada pelo satélite para averiguação in-loco.

## 3. Comunicação Ativa (WhatsApp Integration)
O produtor rural vive no WhatsApp.
- [ ] **Bot de Alertas no WhatsApp**: Envio automático de mensagens curtas: "⚠️ Alerta: Umidade baixa detectada no Pivô 3. Verifique a bomba."
- [ ] **Relatório Resumido Semanal**: PDF simplificado enviado automaticamente toda segunda-feira de manhã no grupo da fazenda.

## 4. Integração IoT e Maquinário
Conectar o mundo digital ao físico.
- [ ] **Conexão com Estações Meteorológicas**: Integrar APIs de estações físicas (ex: Davis, Pessl) para dados de chuva hiperlocais (muito mais precisos que satélite).
- [ ] **Sensores de Solo**: Integração com sondas de umidade para recomendação de irrigação cirúrgica.
- [ ] **Mapas de Colheita**: Importar arquivos do monitor de colheita da colheitadeira para calibrar as estimativas de produtividade do sistema.

## 5. Inteligência de Mercado
- [ ] **Cotações em Tempo Real**: Exibir preço da saca (Soja/Milho/Café) na região atualizado (CEPEA/Esalq).
- [ ] **Calculadora de Lucratividade Avançada**: Cruzar custo de produção x produtividade estimada x cotação atual para dar o lucro em tempo real.

## Minha Recomendação (Prioridade)
Começaria pelo **Bot de WhatsApp** (alto valor perceptível, baixa complexidade) ou pelo **Diário de Campo com Fotos** (engaja o agrônomo no uso diário do app).
