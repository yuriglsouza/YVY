# Documentação Completa do Sistema - YVY Monitoramento 🛰️

## 1. Visão Geral
O **YVY Monitoramento** é uma plataforma avançada de Agricultura de Precisão que utiliza dados de satélites (Sentinel, Landsat) e Inteligência Artificial para monitorar a saúde das lavouras, prever produtividade e identificar anomalias em tempo real.

O sistema foi projetado para ser **robusto, escalável e intuitivo**, oferecendo aos agrônomos e produtores ferramentas poderosas para tomada de decisão baseada em dados.

---

## 2. Arquitetura do Sistema

O sistema segue uma arquitetura moderna e desacoplada:

```mermaid
graph TD
    Client[Frontend (React + Vite)] -->|HTTP/REST| API[Backend (Node.js/Express)]
    API -->|SQL| DB[(PostgreSQL)]
    API -->|Shell Exec| Python[Scripts Python (Data Science)]
    Python -->|libs| ML[Scikit-Learn (IA)]
    Client -->|Maps| Leaflet[Leaflet Maps]
```

-   **Frontend:** React com TypeScript, Tailwind CSS, Shadcn UI, Recharts e React Leaflet.
-   **Backend:** Node.js com Express e Drizzle ORM.
-   **Banco de Dados:** PostgreSQL (estruturado com tabelas para fazendas, leituras, alertas, usuários e zonas).
-   **Data Science:** Python (Pandas, Scikit-Learn, NumPy) para processamento de dados e modelos de IA.

---

## 3. Funcionalidades Implementadas

### 3.1. Monitoramento via Satélite
-   Visualização de imagens RGB e Térmicas.
-   Cálculo de índices de vegetação:
    -   **NDVI** (Vigor da planta)
    -   **NDWI** (Estresse hídrico)
    -   **NDRE** (Clorofila/Nitrogênio)
    -   **RVI (Radar)** (Biomassa e estrutura)

### 3.2. Modelo Preditivo de Produtividade 📈
-   **Algoritmo:** Random Forest Regressor.
-   **Funcionamento:** Analisa o histórico de NDVI, chuva e temperatura para prever a produtividade futura (ex: sacas/ha).
-   **Interface:** Gráfico interativo com projeção de 6 meses.

### 3.3. Clima em Tempo Real 🌦️
-   Integração com API de meteorologia (OpenMeteo).
-   Exibe temperatura atual, umidade, velocidade do vento e condição (sol/chuva).

### 3.4. Sistema de Notificações 🔔
-   Monitoramento automático de índices críticos (ex: NDVI < 0.3).
-   Alertas visuais na interface (sino no menu lateral).
-   Histórico de alertas lidos/não lidos persistido no banco de dados.

### 3.5. Benchmarking de Safras 📊
-   Comparação da performance da fazenda com a média regional.
-   Classificação automática (ex: "Acima da Média", "Top 10%").
-   Gráfico comparativo visual.

### 3.6. Zoneamento de Manejo (Clustering) 🗺️
-   **Algoritmo:** K-Means Clustering.
-   **Funcionamento:**
    1.  Divide a fazenda em micro-regiões baseadas em NDVI/NDWI.
    2.  Agrupa áreas semelhantes em 3 zonas: Alta, Média e Baixa Produtividade.
-   **Visualização:** Mapa de calor interativo com pontos de amostragem.

---

## 4. Referência da API

### `GET /api/farms`
Lista todas as fazendas cadastradas com a última leitura de satélite.

### `GET /api/farms/:id`
Retorna detalhes de uma fazenda específica e seu histórico de leituras.

### `POST /api/predict/train`
Treina o modelo de IA com os dados históricos disponíveis no banco.

### `POST /api/predict/forecast`
Gera uma previsão de produtividade para uma fazenda específica.

### `GET /api/farms/:id/benchmark`
Retorna dados comparativos da fazenda em relação à região.

### `POST /api/farms/:id/zones/generate`
Executa o algoritmo de clusterização e gera as zonas de manejo.

### `GET /api/alerts`
Retorna a lista de notificações do sistema.

---

## 5. Guia de Instalação e Execução

### Pré-requisitos
-   Node.js (v18+) e NPM
-   Python (v3.8+) com `pip`
-   PostgreSQL

### Passo 1: Backend e Banco de Dados
1.  Instale as dependências:
    ```bash
    npm install
    # Instale dependências Python
    pip install pandas scikit-learn numpy
    ```
2.  Configure o arquivo `.env` com as credenciais do banco.
3.  Atualize o schema do banco:
    ```bash
    npm run db:push
    ```

### Passo 2: Rodar a Aplicação
Para desenvolvimento, rode o servidor Node.js (que serve API e Frontend):
```bash
npm run dev
```
O servidor iniciará na porta `5001`. Acesso: `http://localhost:5001`.

---

## 6. Próximos Passos (Roadmap Sugerido)
-   [ ] Integração real com API Sentinel Hub (substituir dados mockados).
-   [ ] Exportação de relatórios em PDF.
-   [ ] App Mobile (React Native) para acesso offline no campo.
