import { useFarms } from "@/hooks/use-farms";
import { useClients } from "@/hooks/use-clients";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import {
  CreateFarmDialog,
  EditFarmDialog,
} from "@/components/CreateFarmDialog";
import { Link } from "wouter";
import {
  Loader2,
  Sprout,
  ArrowRight,
  Pencil,
  Search,
  LayoutGrid,
  List,
  Clock3,
  SlidersHorizontal,
  X,
  LandPlot,
} from "lucide-react";
import { useState } from "react";
import type { Farm } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAreaHa } from "@/lib/format";
import {
  filterAndSortFarms,
  syncLabel,
  syncTimestamp,
  type FarmSort,
} from "@/lib/farm-list";

function FarmCover({ farm }: { farm: Farm }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="relative h-28 overflow-hidden border-b border-border bg-muted/30">
      {farm.imageUrl && failedUrl !== farm.imageUrl ? (
        <img
          src={farm.imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(farm.imageUrl)}
        />
      ) : (
        <div className="flex h-full items-center justify-between bg-gradient-to-br from-emerald-950/60 via-card to-card px-6">
          <span
            className="text-4xl font-semibold tracking-widest text-emerald-200/30"
            aria-hidden="true"
          >
            {farm.name
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
              .toLocaleUpperCase("pt-BR") || "FA"}
          </span>
          <LandPlot
            className="h-12 w-12 text-emerald-300/20"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

function SyncStatus({ farm }: { farm: Farm }) {
  const timestamp = syncTimestamp(farm.lastSyncAt);
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div>
        <p>{syncLabel(farm.lastSyncAt)}</p>
        {timestamp !== null && (
          <time
            className="mt-0.5 block text-slate-400"
            dateTime={new Date(timestamp).toISOString()}
          >
            {new Date(timestamp).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
        )}
      </div>
    </div>
  );
}

function FarmEdit({ farm }: { farm: Farm }) {
  return (
    <EditFarmDialog
      farm={farm}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-slate-300 hover:bg-muted hover:text-white"
          aria-label={`Editar ${farm.name}`}
          title="Editar fazenda"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );
}

export default function FarmList() {
  const { data: farms = [], isLoading, error, refetch } = useFarms();
  const { data: clients = [], isError: clientsError } = useClients();
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [selectedCrop, setSelectedCrop] = useState("all");
  const [sort, setSort] = useState<FarmSort>("name");
  const [view, setView] = useState<"cards" | "list">("cards");
  const clientNames = new Map(
    clients.map((client) => [client.id, client.name]),
  );
  const crops = Array.from(
    new Set(farms.map((farm) => farm.cropType?.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filteredFarms = filterAndSortFarms(
    farms,
    query,
    selectedClientId,
    selectedCrop,
    sort,
  );
  const filtersActive = Boolean(
    query || selectedClientId !== "all" || selectedCrop !== "all",
  );
  const resetFilters = () => {
    setQuery("");
    setSelectedClientId("all");
    setSelectedCrop("all");
  };
  const clientLabel = (farm: Farm) =>
    farm.clientId
      ? clientNames.get(farm.clientId) || "Cliente vinculado"
      : "Sem cliente vinculado";
  const totalArea = farms.reduce(
    (sum, farm) => sum + (Number.isFinite(farm.sizeHa) ? farm.sizeHa : 0),
    0,
  );

  return (
    <div className="relative flex min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <main className="min-w-0 flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
        <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              Minhas fazendas
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {isLoading
                ? "Carregando propriedades…"
                : error
                  ? "Gerencie suas propriedades."
                  : `${farms.length} ${farms.length === 1 ? "fazenda cadastrada" : "fazendas cadastradas"} · ${formatAreaHa(totalArea)} no total`}
            </p>
          </div>
          <CreateFarmDialog />
        </header>

        <section
          aria-label="Buscar e filtrar fazendas"
          className="mb-5 rounded-2xl border border-border bg-card p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr]">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
              />
              <Input
                aria-label="Buscar fazenda pelo nome"
                placeholder="Buscar fazenda pelo nome"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 pl-9 pr-9 placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
            >
              <SelectTrigger
                aria-label="Filtrar por cliente"
                className="h-10 bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                <SelectItem value="none">Sem cliente vinculado</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCrop} onValueChange={setSelectedCrop}>
              <SelectTrigger
                aria-label="Filtrar por cultura"
                className="h-10 bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as culturas</SelectItem>
                {crops.map((crop) => (
                  <SelectItem key={crop} value={crop}>
                    {crop}
                  </SelectItem>
                ))}
                <SelectItem value="none">Cultura não informada</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as FarmSort)}
            >
              <SelectTrigger
                aria-label="Ordenar fazendas"
                className="h-10 bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome: A–Z</SelectItem>
                <SelectItem value="recent">
                  Sincronização mais recente
                </SelectItem>
                <SelectItem value="oldest">
                  Sem sincronização / mais antiga
                </SelectItem>
                <SelectItem value="area">Maior área</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {clientsError && (
            <p role="status" className="mt-3 text-sm text-amber-300">
              Não foi possível carregar os nomes dos clientes. A lista de
              fazendas continua disponível.
            </p>
          )}
        </section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="text-sm text-slate-400">
              {!isLoading && !error
                ? `Exibindo ${filteredFarms.length} de ${farms.length} fazendas`
                : ""}
            </p>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-slate-300 hover:bg-muted hover:text-white"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
          <div
            role="group"
            aria-label="Modo de visualização"
            className="flex gap-1 rounded-lg border border-border bg-card p-1"
          >
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              className={
                view === "cards" ? "bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white" : "text-slate-400 hover:bg-muted hover:text-white"
              }
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Cards
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={
                view === "list" ? "bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white" : "text-slate-400 hover:bg-muted hover:text-white"
              }
            >
              <List className="mr-2 h-4 w-4" />
              Lista
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div
            role="status"
            className="flex min-h-64 items-center justify-center gap-3 text-slate-400"
          >
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando fazendas…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-border bg-card p-10 text-center"
          >
            <h2 className="text-lg font-semibold">
              Não foi possível carregar suas fazendas
            </h2>
            <p className="my-3 text-sm text-slate-400">
              Confira sua conexão e tente novamente.
            </p>
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : filteredFarms.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            {farms.length ? (
              <SlidersHorizontal className="mb-4 h-8 w-8 text-slate-400" />
            ) : (
              <Sprout className="mb-4 h-8 w-8 text-emerald-400" />
            )}
            <h2 className="text-xl font-semibold">
              {farms.length
                ? "Nenhuma fazenda encontrada"
                : "Sua primeira fazenda começa aqui"}
            </h2>
            <p className="mb-5 mt-2 max-w-md text-sm text-slate-400">
              {farms.length
                ? "Tente outro nome ou ajuste os filtros para encontrar a propriedade."
                : "Adicione uma propriedade para começar seu monitoramento."}
            </p>
            {farms.length ? (
              <Button variant="outline" onClick={resetFilters}>
                Limpar filtros
              </Button>
            ) : (
              <CreateFarmDialog />
            )}
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredFarms.map((farm) => (
              <article
                key={farm.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-emerald-600/50"
              >
                <Link
                  href={`/farms/${farm.id}`}
                  aria-label={`Abrir ${farm.name}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <FarmCover farm={farm} />
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-semibold leading-snug">
                        <Link
                          href={`/farms/${farm.id}`}
                          className="hover:text-emerald-300"
                        >
                          {farm.name}
                        </Link>
                      </h2>
                      <p
                        className="mt-1 truncate text-xs text-slate-400"
                        title={clientLabel(farm)}
                      >
                        {clientLabel(farm)}
                      </p>
                    </div>
                    <FarmEdit farm={farm} />
                  </div>
                  <dl className="mb-4 grid grid-cols-2 gap-4 border-b border-border pb-4">
                    <div>
                      <dt className="mb-1 text-xs text-slate-400">Cultura</dt>
                      <dd className="break-words text-sm font-medium">
                        {farm.cropType?.trim() || "Não informada"}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-xs text-slate-400">Área</dt>
                      <dd className="text-sm font-medium">
                        {formatAreaHa(farm.sizeHa)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-auto">
                    <SyncStatus farm={farm} />
                    <Link
                      href={`/farms/${farm.id}`}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      Ver detalhes
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <p className="border-b border-border px-4 py-2 text-xs text-slate-400 lg:hidden">
              Deslize a tabela para ver todas as informações.
            </p>
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Tabela de fazendas"
              tabIndex={0}
            >
              <table className="w-full min-w-[800px] text-left text-sm">
                <caption className="sr-only">
                  Fazendas filtradas, com cliente, cultura, área e última
                  sincronização.
                </caption>
                <thead className="border-b border-border bg-muted/30 text-slate-400">
                  <tr>
                    {[
                      "Fazenda",
                      "Cliente",
                      "Cultura",
                      "Área",
                      "Última sincronização",
                      "Ações",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-5 py-4 font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFarms.map((farm) => (
                    <tr key={farm.id} className="hover:bg-muted/20">
                      <th
                        scope="row"
                        className="max-w-[250px] break-words px-5 py-4 font-semibold"
                      >
                        <Link
                          href={`/farms/${farm.id}`}
                          className="hover:text-emerald-300"
                        >
                          {farm.name}
                        </Link>
                      </th>
                      <td className="max-w-[200px] break-words px-5 py-4 text-slate-300">
                        {clientLabel(farm)}
                      </td>
                      <td className="px-5 py-4">
                        {farm.cropType?.trim() || "Não informada"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {formatAreaHa(farm.sizeHa)}
                      </td>
                      <td className="px-5 py-4">
                        <SyncStatus farm={farm} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/farms/${farm.id}`}
                            aria-label={`Abrir ${farm.name}`}
                            className="rounded-lg p-2 text-emerald-300 hover:bg-muted"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          <FarmEdit farm={farm} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!isLoading && !error && farms.length > 0 && (
          <p className="mt-5 text-xs leading-relaxed text-slate-400">
            A sincronização indica quando o sistema foi atualizado. A data da
            imagem de satélite pode ser diferente e está disponível nos detalhes
            da fazenda.
          </p>
        )}
      </main>
    </div>
  );
}
