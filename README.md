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

### Execução
- Desenvolvimento: `npm run dev`
- Produção: `npm run build && npm run start`
