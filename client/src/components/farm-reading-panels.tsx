import { useState } from "react";
import type { Reading } from "@shared/schema";
import { Cloud, Calendar, Info } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { dailyReadings, readingDateLabel } from "@/lib/farm-reading-context";

const metrics = {
  ndvi: {
    name: "Vigor da vegetação",
    label: "NDVI",
    unit: "",
    color: "#34d399",
    optical: true,
    description:
      "Índice de vegetação. Interprete junto da cultura, da época e das condições da imagem.",
  },
  ndwi: {
    name: "Água na vegetação",
    label: "NDWI",
    unit: "",
    color: "#38bdf8",
    optical: true,
    description:
      "Índice relacionado à água na vegetação; não é uma medição direta de umidade do solo.",
  },
  ndre: {
    name: "Resposta da vegetação",
    label: "NDRE",
    unit: "",
    color: "#a3e635",
    optical: true,
    description:
      "Índice de borda vermelha. A interpretação depende da cultura e do estágio observado.",
  },
  otci: {
    name: "Clorofila",
    label: "OTCI",
    unit: "",
    color: "#facc15",
    optical: true,
    description:
      "Indicador relacionado à clorofila. Não substitui avaliação nutricional em campo.",
  },
  rvi: {
    name: "Estrutura da vegetação",
    label: "RVI",
    unit: "",
    color: "#c4b5fd",
    optical: false,
    description: "Índice derivado do radar, com escala diferente do NDVI.",
  },
  temperature: {
    name: "Temperatura da superfície",
    label: "LST",
    unit: " °C",
    color: "#fb923c",
    optical: false,
    description:
      "Temperatura estimada da superfície na leitura; difere da temperatura do ar.",
  },
} as const;
type Metric = keyof typeof metrics;
const numeric = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ReadingQuality({
  reading,
}: {
  reading: Reading | null | undefined;
}) {
  const cloudy = (reading?.cloudCover ?? 0) > 0.6;
  return (
    <section
      aria-label="Contexto da leitura"
      className={`mb-5 rounded-2xl border p-4 sm:p-5 ${cloudy || reading?.isSimulated ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Calendar className="h-4 w-4 text-slate-400" />
          Imagem analisada:{" "}
          {reading ? readingDateLabel(reading.date) : "Nenhuma disponível"}
        </span>
        <span className="flex items-center gap-2 text-slate-300">
          <Cloud className="h-4 w-4" />
          {typeof reading?.cloudCover === "number"
            ? `${Math.round(reading.cloudCover * 100)}% de nuvens estimadas no período`
            : "Cobertura de nuvens não informada"}
        </span>
      </div>
      <p
        className={`mt-2 text-sm leading-relaxed ${cloudy || reading?.isSimulated ? "text-amber-200" : "text-slate-400"}`}
      >
        {!reading
          ? "Sincronize o satélite para buscar uma leitura da propriedade."
          : reading.isSimulated
            ? "Esta leitura é simulada. Não representa uma observação real da propriedade."
            : cloudy
              ? "Nuvens podem comprometer os índices ópticos. Estes valores, isoladamente, não confirmam uma condição crítica da lavoura. Confira o histórico e a vistoria."
              : "Os valores correspondem à data da imagem, não necessariamente à condição de hoje. Interprete-os junto do histórico e das observações de campo."}
      </p>
    </section>
  );
}

export function ReadingMetrics({ reading }: { reading: Reading }) {
  return (
    <section
      aria-label="Indicadores da leitura mais recente"
      className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6"
    >
      {(Object.keys(metrics) as Metric[]).map((key) => {
        const metric = metrics[key];
        const value = reading[key];
        const limited = metric.optical && (reading.cloudCover ?? 0) > 0.6;
        return (
          <article
            key={key}
            className="min-w-0 rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs font-medium text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {typeof value === "number" && Number.isFinite(value)
                ? numeric(value) + metric.unit
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-300">{metric.name}</p>
            {limited && (
              <p className="mt-2 text-xs text-amber-200">
                Leitura limitada por nuvens
              </p>
            )}
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer">Sobre o indicador</summary>
              <p className="mt-2 leading-relaxed">{metric.description}</p>
            </details>
          </article>
        );
      })}
    </section>
  );
}

export function FarmHistoryChart({ readings }: { readings: Reading[] }) {
  const [metric, setMetric] = useState<Metric>("ndvi");
  const [period, setPeriod] = useState("all");
  const all = dailyReadings(readings.filter((reading) => !reading.isSimulated));
  const end = all.length ? new Date(all[all.length - 1].date).getTime() : 0;
  const data = all.filter(
    (reading) =>
      period === "all" ||
      new Date(reading.date).getTime() >= end - Number(period) * 86400000,
  );
  const config = metrics[metric];
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Histórico dos indicadores</h2>
          <p className="mt-1 text-sm text-slate-400">
            Período até a leitura mais recente. Cada indicador tem sua própria
            escala.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Indicador do histórico"
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            className="rounded-lg border border-border bg-background p-2 text-sm"
          >
            {(Object.keys(metrics) as Metric[]).map((key) => (
              <option key={key} value={key}>
                {metrics[key].label} — {metrics[key].name}
              </option>
            ))}
          </select>
          <select
            aria-label="Período do histórico"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="rounded-lg border border-border bg-background p-2 text-sm"
          >
            <option value="all">Todo o histórico</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="365">1 ano</option>
          </select>
        </div>
      </div>
      {data.length ? (
        <div className="h-[280px] w-full sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 15, right: 15, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                stroke="#334155"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => readingDateLabel(value).slice(0, 5)}
                minTickGap={35}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                domain={
                  metric === "ndvi" || metric === "ndwi" || metric === "ndre"
                    ? [-1, 1]
                    : ["auto", "auto"]
                }
                tickFormatter={(value) => numeric(Number(value))}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  background: "#181c24",
                  border: "1px solid #334155",
                  borderRadius: 12,
                }}
                labelFormatter={(value) => readingDateLabel(String(value))}
                formatter={(value: number) => [
                  numeric(value) + config.unit,
                  config.label,
                ]}
              />
              <Line
                type="linear"
                dataKey={metric}
                name={config.label}
                stroke={config.color}
                strokeWidth={2}
                dot={data.length <= 30}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-slate-400">
          Nenhuma leitura disponível neste período.
        </p>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
        <Info className="h-4 w-4 shrink-0" />
        {config.description} Leituras simuladas, quando existentes no histórico,
        não representam medições reais.
      </p>
    </section>
  );
}
