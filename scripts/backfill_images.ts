import dotenv from "dotenv";
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function runBackfill() {
  console.log("🚀 Iniciando backfill de imagens históricas...");
  console.log(`📡 API_BASE_URL: ${API_BASE_URL}`);
  console.log(`🔑 ADMIN_SECRET configurada: ${!!ADMIN_SECRET}`);

  if (!ADMIN_SECRET) {
    console.error("❌ ADMIN_SECRET não configurado no .env");
    process.exit(1);
  }

  if (!API_BASE_URL) {
    console.error("❌ API_BASE_URL não configurada no .env. Use a URL da Vercel ou localhost:5000.");
    process.exit(1);
  }

  try {
      // 1. Get readings that need backfill
      const fetchUrl = `${API_BASE_URL}/api/admin/readings/backfill-bulk?limit=20`;
      console.log(`[BACKFILL_FETCH_PENDING] url=${fetchUrl}`);

      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: {
          "x-admin-secret": ADMIN_SECRET,
          "Content-Type": "application/json"
        }
      });

      const responseBody = await response.text();
      console.log(`[BACKFILL_FETCH_PENDING_RESPONSE] status=${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.error("[BACKFILL_FETCH_PENDING_ERROR]", {
          status: response.status,
          statusText: response.statusText,
          body: responseBody.slice(0, 1000),
        });
        return;
      }

      let data;
      try {
          data = JSON.parse(responseBody);
      } catch (e) {
          console.error("❌ Erro ao parsear JSON da resposta:", responseBody);
          return;
      }

      console.log(`✅ Encontradas ${data.readingsFound?.length || 0} leituras necessitando de backfill.`);

      if (!data.readingsFound || data.readingsFound.length === 0) {
        console.log("🙌 Nenhuma leitura pendente encontrada.");
        return;
      }

      for (const id of data.readingsFound) {
        console.log(`⏳ Processando leitura ${id}...`);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/readings/${id}/backfill-images`, {
              method: "POST",
              headers: {
                "x-admin-secret": ADMIN_SECRET,
                "Content-Type": "application/json"
              }
            });
            
            const result = (await res.json()) as any;
            if (res.ok) {
              console.log(`✅ Leitura ${id} atualizada com sucesso: ${result.satelliteImage}`);
            } else {
              console.error(`❌ Erro na leitura ${id}: ${result.message || result.details}`);
            }
        } catch (err: any) {
            console.error(`❌ Falha na requisição para leitura ${id}: ${err.message}`);
        }
      }
  } catch (globalErr: any) {
      console.error("❌ Erro fatal no script de backfill:", globalErr.message);
  }
}

runBackfill();
