# Guia de Deploy - Google Cloud Run 🚀

Este guia contém os comandos para colocar sua aplicação **YVY** no ar usando o Google Cloud Run.

## Pré-requisitos
1. Ter o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalado.
2. Ter um projeto criado no Google Cloud.

## 1. Login e Configuração
Primeiro, faça login na sua conta e defina o projeto:

```bash
gcloud auth login
gcloud config set project [SEU_ID_DO_PROJETO]
```

## 2. Comando de Deploy (Modo Gratuito/Econômico)
Use o comando abaixo para construir e implantar a aplicação. Este comando usa a flag `--source .`, que envia seu código para o Cloud Build, lê o `Dockerfile` e implanta no Cloud Run automaticamente.

**Nota sobre custos**: O Cloud Run tem uma camada gratuita generosa (2 milhões de requisições/mês), mas requer um cartão de crédito para ativar o projeto. A região `us-central1` é geralmente a mais barata e compatível com o free tier.

```bash
gcloud run deploy yvy-app \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars="NODE_ENV=production,OPENAI_API_KEY=sua_chave_aqui"
```

### Explicação das Flags:
- `--source .`: Usa o diretório atual para buildar a imagem.
- `--region us-central1`: Região comum para a camada gratuita (LowCO2).
- `--allow-unauthenticated`: Permite que qualquer pessoa acesse o site (público).
- `--memory 1Gi`: Limita a memória para evitar custos excessivos (pode aumentar se precisar).

## 3. Autenticação do Google Earth Engine (Importante!) 🌍
Como a aplicação usa o `earthengine-api`, o container precisa de permissão para acessar o GEE.

A maneira mais segura em produção é usar uma **Service Account**:
1. Crie uma Service Account no console do Google Cloud.
2. Dê permissão de acesso ao Earth Engine para ela.
3. Gere uma chave JSON.
4. No código (que precisaria de um pequeno ajuste) ou via variável de ambiente `GOOGLE_APPLICATION_CREDENTIALS`, aponte para essa chave.

*Alternativa Simples (Token)*:
Se você já rodou `earthengine authenticate` localmente, pode tentar passar o conteúdo das credenciais como variável de ambiente, mas a Service Account é a recomendada.
