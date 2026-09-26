import { useState } from "react";
import { useFarms } from "@/hooks/use-farms";
import { useUser } from "@/hooks/use-user";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { CreateFarmDialog } from "@/components/CreateFarmDialog";
import { PredictiveChartWrapper } from "@/components/predictive-chart-wrapper";
import { Link } from "wouter";
import {
  Loader2,
  Sprout,
  ArrowUpRight,
  Search,
  Satellite,
  Info,
  MapPin,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDecimal } from "@/lib/format";
import { readingDateLabel } from "@/lib/farm-reading-context";
import {
  summarizeDashboard,
  type DashboardFarm,
  type ReadingKind,
} from "@/lib/dashboard-summary";

const tones: Record<ReadingKind, string> = {
  high: "text-emerald-300 bg-emerald-400/10",
  medium: "text-amber-200 bg-amber-400/10",
  low: "text-orange-300 bg-orange-400/10",
  cloudy: "text-sky-300 bg-sky-400/10",
  missing: "text-slate-300 bg-slate-400/10",
  invalid: "text-slate-300 bg-slate-400/10",
  simulated: "text-violet-300 bg-violet-400/10",
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const pageSize = 6;

export default function Dashboard() {
  const { data: user } = useUser();
  const { data, isLoading, error, refetch } = useFarms();
  const allFarms = (data || []) as DashboardFarm[];
  const [owner, setOwner] = useState("all");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState("priority");
  const [page, setPage] = useState(0);
  const [reviewLimit, setReviewLimit] = useState(4);
  const owners = Array.from(
    new Set(
      allFarms
        .map((f) => f.ownerEmail)
        .filter((email): email is string => !!email),
    ),
  ).sort();
  const farms =
    user?.role === "admin" && owner !== "all"
      ? allFarms.filter((f) => f.ownerEmail === owner)
      : allFarms;
  const summary = summarizeDashboard(farms);
  const rows = summary.rows
    .filter((row) =>
      normalize(row.farm.name).includes(normalize(search.trim())),
    )
    .sort((a, b) => {
      if (order === "name")
        return a.farm.name.localeCompare(b.farm.name, "pt-BR");
      if (order === "ndvi")
        return (
          (a.measured ? a.value! : Infinity) -
            (b.measured ? b.value! : Infinity) ||
          a.farm.name.localeCompare(b.farm.name, "pt-BR")
        );
      return (
        a.priority - b.priority ||
        a.farm.name.localeCompare(b.farm.name, "pt-BR")
      );
    });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const premium =
    user?.role === "admin" || user?.subscriptionStatus === "active";

  return (
    <div className="relative flex min-h-screen bg-background [&_.text-muted-foreground]:text-slate-400">
      <Sidebar />
      <MobileNav />
      <main className="min-w-0 flex-1 p-4 pt-16 lg:ml-64 lg:p-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-emerald-400">
              Monitoramento das propriedades
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Visão geral</h1>
            <p className="mt-2 text-sm text-slate-400">
              Leituras, histórico e pontos para acompanhar nas suas fazendas.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {user?.role === "admin" && (
              <select
                aria-label="Filtrar por proprietário"
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setPage(0);
                  setReviewLimit(4);
                }}
                className="h-10 max-w-full rounded-xl border border-border bg-card px-3 text-sm sm:max-w-60"
              >
                <option value="all">Todos os proprietários</option>
                {owners.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            )}
            <CreateFarmDialog />
          </div>
        </header>
        {isLoading ? (
          <div
            role="status"
            className="flex items-center gap-3 py-20 text-slate-400"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando fazendas...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-border bg-card p-6"
          >
            <p>Não foi possível carregar o painel.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <section
              aria-label="Resumo das fazendas"
              className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4"
            >
              {[
                {
                  label: "Fazendas",
                  value: String(summary.total),
                  detail: "No filtro de proprietário",
                  icon: MapPin,
                },
                {
                  label: "Área cadastrada",
                  value: formatDecimal(summary.area),
                  detail: "Hectares no filtro",
                  icon: Sprout,
                },
                {
                  label: "Com leitura de NDVI",
                  value: String(summary.measured),
                  detail: "Não simulada · confira a data",
                  icon: Satellite,
                },
                {
                  label: "Para conferir",
                  value: String(summary.review.length),
                  detail: "Índice ou qualidade da leitura",
                  icon: ScanLine,
                },
              ].map(({ label, value, detail, icon: Icon }) => (
                <article
                  key={label}
                  className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-300">{label}</p>
                    <Icon className="h-4 w-4 shrink-0 text-emerald-400" />
                  </div>
                  <p className="mt-3 break-words text-3xl font-semibold tracking-tight">
                    {value}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{detail}</p>
                </article>
              ))}
            </section>
            {farms.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Sprout className="mx-auto mb-4 h-8 w-8 text-emerald-400" />
                <h2 className="text-xl font-semibold">
                  Nenhuma fazenda neste filtro
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Cadastre uma propriedade ou selecione outro proprietário para
                  começar.
                </p>
              </section>
            ) : (
              <>
                <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
                  <section
                    className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6"
                    aria-label="Comparação entre fazendas"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">
                          NDVI por fazenda
                        </h2>
                        <p className="mt-1 text-sm text-slate-400">
                          Última leitura de cada propriedade.
                        </p>
                      </div>
                      <Link
                        href="/farms"
                        className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:underline"
                      >
                        Todas as fazendas <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="my-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
                        <Search className="h-4 w-4 shrink-0 text-slate-400" />
                        <input
                          aria-label="Buscar fazenda no comparativo"
                          placeholder="Buscar fazenda..."
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                          }}
                          className="h-10 w-full min-w-0 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        />
                      </label>
                      <select
                        aria-label="Ordenar comparação"
                        value={order}
                        onChange={(e) => {
                          setOrder(e.target.value);
                          setPage(0);
                        }}
                        className="h-10 max-w-full rounded-xl border border-border bg-background px-3 text-sm"
                      >
                        <option value="priority">Pontos para conferir</option>
                        <option value="name">Nome da fazenda</option>
                        <option value="ndvi">Menor NDVI primeiro</option>
                      </select>
                    </div>
                    <div className="divide-y divide-border">
                      {rows
                        .slice(
                          currentPage * pageSize,
                          (currentPage + 1) * pageSize,
                        )
                        .map((row) => (
                          <Link
                            key={row.farm.id}
                            href={`/farms/${row.farm.id}`}
                            className="group block rounded-lg py-4 transition-colors hover:bg-white/[.025] focus-visible:outline focus-visible:outline-emerald-500"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words font-medium group-hover:text-emerald-300">
                                  {row.farm.name}
                                </h3>
                                <p className="mt-1 text-xs text-slate-400">
                                  {row.farm.cropType || "Cultura não informada"}{" "}
                                  ·{" "}
                                  {row.farm.latestReading
                                    ? readingDateLabel(
                                        row.farm.latestReading.date,
                                      )
                                    : "Sem data de leitura"}
                                </p>
                              </div>
                              <span className="shrink-0 text-lg font-semibold tabular-nums">
                                {row.measured ? formatDecimal(row.value!) : "—"}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <div
                                aria-hidden="true"
                                className="relative h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-slate-700/60"
                              >
                                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400/60" />
                                {row.measured && (
                                  <span
                                    className={`absolute inset-y-0 rounded-full ${row.kind === "cloudy" ? "bg-sky-400/60" : row.kind === "low" ? "bg-orange-400" : row.kind === "medium" ? "bg-amber-400" : "bg-emerald-400"}`}
                                    style={{
                                      left: `${row.value! < 0 ? (row.value! + 1) * 50 : 50}%`,
                                      width: `${Math.abs(row.value!) * 50}%`,
                                    }}
                                  />
                                )}
                              </div>
                              <span
                                className={`rounded-md px-2 py-1 text-xs ${tones[row.kind]}`}
                              >
                                {row.label}
                              </span>
                              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-300" />
                            </div>
                          </Link>
                        ))}
                      {!rows.length && (
                        <p className="py-10 text-center text-sm text-slate-400">
                          Nenhuma fazenda encontrada para esta busca.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <p className="text-xs text-slate-400" aria-live="polite">
                        {rows.length
                          ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, rows.length)} de ${rows.length} fazendas`
                          : "0 fazendas"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 0}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage + 1 >= pages}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                    <p className="mt-4 flex gap-2 text-xs leading-relaxed text-slate-400">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      Escala de −1 a 1, com zero no centro. As datas podem
                      variar. NDVI baixo não confirma, isoladamente, um problema
                      na lavoura.
                    </p>
                  </section>
                  <aside
                    className="rounded-2xl border border-border bg-card p-4 sm:p-6"
                    aria-label="Pontos para conferir"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">Para conferir</h2>
                      <span className="rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
                        {summary.review.length}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      Abra a fazenda para avaliar a leitura no contexto do
                      histórico e da vistoria.
                    </p>
                    <div className="mt-5 space-y-3">
                      {summary.review.slice(0, reviewLimit).map((row) => (
                        <Link
                          key={row.farm.id}
                          href={`/farms/${row.farm.id}`}
                          className="block rounded-xl border border-border p-4 hover:border-slate-500 focus-visible:outline focus-visible:outline-emerald-500"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="min-w-0 break-words text-sm font-medium">
                              {row.farm.name}
                            </h3>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                          </div>
                          <span
                            className={`mt-2 inline-block rounded-md px-2 py-1 text-xs ${tones[row.kind]}`}
                          >
                            {row.label}
                          </span>
                          <p className="mt-2 text-xs leading-relaxed text-slate-400">
                            {row.reason}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {row.farm.latestReading
                              ? readingDateLabel(row.farm.latestReading.date)
                              : "Sem leitura registrada"}
                          </p>
                        </Link>
                      ))}
                    </div>
                    {!summary.review.length && (
                      <p className="py-8 text-sm text-slate-300">
                        Nenhum ponto sinalizado por estes critérios. Continue
                        acompanhando as datas e as vistorias.
                      </p>
                    )}
                    {summary.review.length > reviewLimit && (
                      <Button
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => setReviewLimit((limit) => limit + 4)}
                      >
                        Mostrar mais ({summary.review.length - reviewLimit})
                      </Button>
                    )}
                  </aside>
                </div>
                <section className="mt-6" aria-label="Projeção de vigor">
                  {premium ? (
                    <PredictiveChartWrapper farms={farms} />
                  ) : (
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <h2 className="text-xl font-semibold">
                        Projeção de vigor
                      </h2>
                      <p className="my-3 text-sm text-slate-400">
                        Explore cenários estimados pelo modelo no plano Premium.
                      </p>
                      <Link href="/plans">
                        <Button variant="outline">Conhecer o Premium</Button>
                      </Link>
                    </div>
                  )}
                </section>
              </>
            )}
            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              As informações resumem as últimas leituras registradas, não
              necessariamente as condições de hoje. O painel não substitui a
              avaliação em campo.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
