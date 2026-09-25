const API_ORIGIN = "https://yvy-g8z9.vercel.app";
export const FARM_INTERVAL_MS = 5 * 60 * 1000;

export async function runSatelliteBatch({ apiRequest, sleep, dryRun = false, onlyFarmId = null, log = console.log }) {
  const response = await apiRequest("GET", "/api/cron/farms");
  if (!Array.isArray(response.farmIds) || !response.farmIds.every(id => Number.isSafeInteger(id) && id > 0)) {
    throw new Error("Lista de fazendas inválida");
  }

  const farmIds = [...new Set(response.farmIds)].sort((a, b) => a - b);
  if (onlyFarmId !== null && !farmIds.includes(onlyFarmId)) {
    throw new Error(`Fazenda ${onlyFarmId} não encontrada`);
  }
  const selected = onlyFarmId === null ? farmIds : [onlyFarmId];
  log(`Fazendas encontradas: ${farmIds.length}; selecionadas: ${selected.length}`);
  if (dryRun) {
    log(`Teste sem sincronizar. IDs: ${selected.join(", ") || "nenhum"}`);
    return { total: selected.length, successes: [], failures: [] };
  }

  const successes = [];
  const failures = [];
  for (const [index, farmId] of selected.entries()) {
    log(`Sincronizando fazenda ${farmId} (${index + 1}/${selected.length})`);
    try {
      const result = await apiRequest("POST", `/api/cron/farms/${farmId}/sync`);
      if (result.success !== true || result.farmId !== farmId) throw new Error("Resposta de sincronização inválida");
      successes.push(farmId);
      log(`Fazenda ${farmId}: concluída`);
    } catch (error) {
      failures.push({ farmId, error: error instanceof Error ? error.message : String(error) });
      log(`Fazenda ${farmId}: falhou (${failures.at(-1).error})`);
    }

    if (index < selected.length - 1) {
      log("Aguardando 5 minutos antes da próxima fazenda");
      await sleep(FARM_INTERVAL_MS);
    }
  }

  log(`Resumo: ${successes.length} concluídas, ${failures.length} falhas, ${selected.length} fazendas`);
  if (failures.length) throw new Error(`Falhas nas fazendas: ${failures.map(item => item.farmId).join(", ")}`);
  return { total: selected.length, successes, failures };
}

async function githubIdToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) throw new Error("GitHub OIDC indisponível");
  const url = new URL(requestUrl);
  url.searchParams.set("audience", "syaz-satellite-sync");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${requestToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Falha ao obter token do GitHub: HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.value !== "string") throw new Error("Token do GitHub inválido");
  return data.value;
}

async function apiRequest(method, path) {
  const token = await githubIdToken();
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(method === "POST" ? 295000 : 30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}${body.code ? ` ${body.code}` : ""}`);
  return body;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.env.DRY_RUN === "true";
  const farmIdRaw = process.env.FARM_ID || "";
  const onlyFarmId = farmIdRaw ? Number(farmIdRaw) : null;
  if (onlyFarmId !== null && (!Number.isSafeInteger(onlyFarmId) || onlyFarmId <= 0)) {
    throw new Error("FARM_ID inválido");
  }
  await runSatelliteBatch({
    apiRequest,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    dryRun,
    onlyFarmId,
  });
}
import { pathToFileURL } from "node:url";
