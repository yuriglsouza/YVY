import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:5000";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function runBackfill() {
  if (!ADMIN_SECRET) {
    console.error("❌ ADMIN_SECRET não configurado no .env");
    process.exit(1);
  }

  console.log("🚀 Iniciando backfill de imagens históricas...");
  
  try {
      // 1. Get readings that need backfill
      const response = await fetch(`${API_URL}/api/admin/readings/backfill-bulk?limit=20`, {
        method: "POST",
        headers: {
          "x-admin-secret": ADMIN_SECRET,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        console.error("❌ Falha ao buscar leituras:", await response.text());
        return;
      }

      const data = (await response.json()) as any;
      console.log(`✅ Encontradas ${data.readingsFound?.length || 0} leituras necessitando de backfill.`);

      if (!data.readingsFound || data.readingsFound.length === 0) {
        console.log("🙌 Nenhuma leitura pendente encontrada.");
        return;
      }

      for (const id of data.readingsFound) {
        console.log(`⏳ Processando leitura ${id}...`);
        try {
            const res = await fetch(`${API_URL}/api/admin/readings/${id}/backfill-images`, {
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
