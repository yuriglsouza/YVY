# YVY - Monitoramento via Satélite 🛰️

Sistema avançado de monitoramento agrícola utilizando dados de múltiplos satélites.

## Satélites Integrados
- **Sentinel-1** (Radar SAR): Para estrutura e biomassa (RVI).
- **Sentinel-2** (Óptico): Para índices de vegetação (NDVI, NDRE) e clorofila (OTCI).
- **Landsat 8/9** (Térmico): Para temperatura da superfície (LST) com alta resolução (100m).
- **Sentinel-3 / MODIS**: Dados complementares.

## Funcionalidades
- Dashboard interativo com mapas e gráficos.
- Análise de séries temporais.
- Relatórios agronômicos via IA.
- Alertas por e-mail.

## Tecnologias
- React / Tailwind CSS
- Node.js / Express
- PostgreSQL
## Configuração e Deploy

### Variáveis de Ambiente
Crie um arquivo `.env` baseado no `.env.example` e preencha as chaves necessárias, incluindo:
- `GEMINI_MODEL`: Padrão recomendado `gemini-2.5-flash`.

### Banco de Dados (Migrations)
O projeto utiliza Drizzle ORM. Para aplicar alterações no schema:
1. **Local/Desenvolvimento**: `npm run db:push`
2. **Produção (Recomendado)**: `npx drizzle-kit migrate`
   *As migrations versionadas estão localizadas na pasta `/migrations`.*

### Manutenção (Heartbeat / Keep-Alive)
No plano gratuito do Render, os serviços entram em modo de espera após 15 minutos de inatividade. Para evitar atrasos na primeira sincronização, o projeto inclui um workflow do GitHub Actions (`.github/workflows/heartbeat.yml`) que roda a cada 10 minutos.

#### Configuração das Secrets (GitHub)
No seu repositório GitHub, vá em **Settings > Secrets and variables > Actions** e adicione:
- `PYTHON_SERVICE_URL`: URL base do seu serviço Python no Render (ex: `https://seu-servico.onrender.com`).
- `HEARTBEAT_SECRET` (Opcional): Uma chave segura para proteger o endpoint de warmup.

#### Configuração no Render
O serviço de satélite requer autenticação com o **Google Earth Engine (GEE)**. Adicione as seguintes variáveis no painel do Render:
- `GEE_PROJECT_ID`: O ID do seu projeto no Google Cloud (que tem a API do GEE ativada).
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: O conteúdo JSON completo da sua Service Account do Google.
- `HEARTBEAT_SECRET` (Opcional): A mesma chave configurada no GitHub.

> **Importante sobre Dados Simulados**: O sistema foi ajustado para bloquear simulações de satélite em produção. Se as credenciais do GEE estiverem incorretas, o aplicativo retornará erro. Para habilitar dados simulados explicitamente em desenvolvimento, adicione `ALLOW_SIMULATED_SATELLITE_DATA=true` no seu arquivo `.env`.

> **Nota**: Manter o serviço acordado 24/7 consome aproximadamente 720 horas/mês. Monitore os limites do seu plano Render Free (geralmente 750h/mês).

### Execução
- Desenvolvimento: `npm run dev`
- Produção: `npm run build && npm run start`
