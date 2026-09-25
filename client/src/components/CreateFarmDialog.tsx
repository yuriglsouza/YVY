import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSchema, type InsertFarm, type Farm } from "@shared/schema";
import { useCreateFarm, useUpdateFarm } from "@/hooks/use-farms";
import { useClients } from "@/hooks/use-clients";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Map,
  Keyboard,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  Check,
  LandPlot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadFarmImage } from "@/lib/farm-image-upload";
import { validateFarmImageMetadata } from "@shared/farm-image";
import { formatAreaHa } from "@/lib/format";
import { z } from "zod";
import { cropStageSchema } from "@shared/crop-stage";

// Lazy load the map picker to avoid SSR issues & reduce bundle for non-map users
const PolygonMapPicker = lazy(() =>
  import("@/components/PolygonMapPicker").then((m) => ({
    default: m.PolygonMapPicker,
  })),
);

type DrawMode = "manual" | "map";
const sections = [
  "Dados da fazenda",
  "Localização e área",
  "Cultivo e revisão",
];
const descriptions = [
  "Comece pela identificação da propriedade.",
  "Localize a propriedade e defina a área monitorada.",
  "Informe a cultura e confira os dados antes de salvar.",
];
const formSchema = insertFarmSchema.extend({
  name: z.string().trim().min(1, "Informe o nome da fazenda."),
  cropType: z.string().trim().min(1, "Selecione a cultura."),
  sizeHa: z
    .number({ invalid_type_error: "Informe a área em hectares." })
    .positive("Informe uma área maior que zero."),
  latitude: z
    .number({ invalid_type_error: "Informe a latitude." })
    .min(-90, "Latitude entre -90 e 90.")
    .max(90, "Latitude entre -90 e 90."),
  longitude: z
    .number({ invalid_type_error: "Informe a longitude." })
    .min(-180, "Longitude entre -180 e 180.")
    .max(180, "Longitude entre -180 e 180."),
});
const dialogClass =
  "flex h-[94dvh] max-h-[900px] w-[calc(100%-1rem)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl sm:w-[calc(100%-3rem)] sm:rounded-2xl [&_.text-muted-foreground]:text-slate-400";

function FarmForm({
  onSubmit,
  onCancel,
  defaultValues,
  isPending,
  submitLabel,
}: {
  onSubmit: (data: InsertFarm) => Promise<void>;
  onCancel: () => void;
  defaultValues?: Partial<InsertFarm>;
  isPending: boolean;
  submitLabel: string;
}) {
  const { data: clients } = useClients();
  const { toast } = useToast();
  const [drawMode, setDrawMode] = useState<DrawMode>(
    defaultValues && !defaultValues.polygon ? "manual" : "map",
  );
  const editing = Boolean(defaultValues);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [stageError, setStageError] = useState("");
  const [mapEditing, setMapEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [stage, setStage] = useState(defaultValues?.cropStage?.stage || "");
  const [observedOn, setObservedOn] = useState(
    defaultValues?.cropStage?.observedOn || "",
  );

  const form = useForm<InsertFarm>({
    resolver: zodResolver(formSchema),
    shouldFocusError: false,
    defaultValues: {
      name: "",
      cropType: "",
      sizeHa: 0,
      latitude: 0,
      longitude: 0,
      clientId: null,
      imageUrl: "",
      polygon: null,
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const busy = isPending || isUploadingImage || form.formState.isSubmitting;
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);
  const goNext = async () => {
    if (
      await form.trigger(
        step === 0 ? ["name"] : ["sizeHa", "latitude", "longitude"],
      )
    ) {
      setStep(step + 1);
      setFurthestStep(Math.max(furthestStep, step + 1));
    }
  };
  const showInvalidSection = (errors: FieldErrors<InsertFarm>) => {
    setStep(
      errors.name || errors.imageUrl || errors.clientId
        ? 0
        : errors.sizeHa || errors.latitude || errors.longitude || errors.polygon
          ? 1
          : 2,
    );
    toast({
      title: "Confira os campos destacados",
      description: "Seus dados continuam preenchidos.",
      variant: "destructive",
    });
  };
  const handleSubmit = async (data: InsertFarm) => {
    const observation =
      stage.trim() || observedOn
        ? cropStageSchema.safeParse({ stage, observedOn })
        : null;
    if (observation && !observation.success) {
      setStageError(observation.error.issues[0].message);
      setStep(2);
      return;
    }
    setStageError("");
    let imageUrl = data.imageUrl;

    if (imageFile) {
      setIsUploadingImage(true);
      try {
        imageUrl = await uploadFarmImage(imageFile);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro ao enviar foto",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível enviar a foto.",
        });
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(false);
    }

    await onSubmit({
      ...data,
      cropStage: observation?.success ? observation.data : null,
      imageUrl: imageUrl || null,
    });
  };

  const handlePolygonChange = (
    data: {
      polygon: [number, number][];
      centroid: { lat: number; lon: number };
      areaHa: number;
    } | null,
  ) => {
    if (data) {
      form.setValue("polygon", data.polygon);
      form.setValue("latitude", parseFloat(data.centroid.lat.toFixed(6)));
      form.setValue("longitude", parseFloat(data.centroid.lon.toFixed(6)));
      form.setValue("sizeHa", parseFloat(data.areaHa.toFixed(2)), {
        shouldValidate: true,
      });
    } else {
      form.setValue("polygon", null);
      form.setValue("sizeHa", 0, { shouldValidate: true });
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        if (mapEditing) {
          event.preventDefault();
          return;
        }
        if (!editing && step < 2) {
          event.preventDefault();
          void goNext();
        } else {
          void form.handleSubmit(handleSubmit, showInvalidSection)(event);
        }
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <nav
        aria-label={editing ? "Seções da fazenda" : "Etapas do cadastro"}
        className="grid shrink-0 grid-cols-3 gap-1 border-b border-border px-3 py-3 sm:gap-3 sm:px-7"
      >
        {sections.map((title, index) => (
          <button
            key={title}
            type="button"
            disabled={busy || mapEditing || (!editing && index > furthestStep)}
            aria-current={step === index ? "step" : undefined}
            onClick={() => setStep(index)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 sm:flex-row sm:gap-2 sm:justify-start sm:px-4 sm:py-3 sm:text-sm ${step === index ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${step === index ? "bg-emerald-700 text-white" : "bg-muted"}`}
            >
              {!editing && index < step ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </span>
            <span className="font-medium sm:hidden">
              {["Dados", "Localização", "Cultivo"][index]}
            </span>
            <span className="hidden font-medium sm:inline">{title}</span>
          </button>
        ))}
      </nav>
      <div
        ref={contentRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7"
      >
        <div className="mb-6">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            {sections[step]}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {descriptions[step]} Campos com * são obrigatórios.
          </p>
        </div>
        <section hidden={step !== 0} aria-label="Dados da fazenda">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome da fazenda *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  className="h-11 rounded-lg"
                  placeholder="ex: Gleba A Vale do Sol"
                />
                {form.formState.errors.name && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="clientId">Cliente (opcional)</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue(
                      "clientId",
                      value === "none" ? null : Number(value),
                    )
                  }
                  defaultValue={
                    form.getValues("clientId")
                      ? String(form.getValues("clientId"))
                      : undefined
                  }
                  value={
                    form.watch("clientId")
                      ? String(form.watch("clientId"))
                      : "none"
                  }
                >
                  <SelectTrigger id="clientId" className="h-11 rounded-lg">
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente vinculado</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {client.name}{" "}
                        {client.company ? `(${client.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <LandPlot className="mb-3 h-6 w-6 text-primary" />
                <p className="text-sm font-medium">
                  Cada propriedade, no seu lugar
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Na próxima etapa, localize a fazenda e desenhe o limite da
                  área que deseja monitorar.
                </p>
              </div>
            </div>{" "}
            <div className="grid content-start gap-4 rounded-2xl border border-border bg-muted/15 p-5">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-primary" />
                <Label htmlFor="farmImage">
                  Foto da propriedade (opcional)
                </Label>
              </div>
              {!(imagePreview || form.watch("imageUrl")) && (
                <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground">
                  <ImagePlus className="h-8 w-8" />
                  <p className="text-sm">
                    Uma foto para identificar sua fazenda
                  </p>
                </div>
              )}
              <Input
                id="farmImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="rounded-lg"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (!file) {
                    setImageFile(null);
                    return;
                  }

                  const validationError = validateFarmImageMetadata({
                    contentType: file.type,
                    size: file.size,
                  });
                  if (validationError) {
                    toast({
                      variant: "destructive",
                      title: "Foto inválida",
                      description: validationError,
                    });
                    event.target.value = "";
                    setImageFile(null);
                    return;
                  }

                  setImageFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou WebP, com até 6 MB.
              </p>
              {(imagePreview || form.watch("imageUrl")) && (
                <img
                  src={imagePreview || form.watch("imageUrl") || ""}
                  alt="Prévia da fazenda"
                  className="h-36 w-full rounded-lg border border-border object-cover"
                />
              )}

              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Usar endereço de uma imagem
                </summary>
                <Label
                  htmlFor="imageUrl"
                  className="text-xs text-muted-foreground"
                >
                  Ou cole o endereço de uma imagem
                </Label>
                <Input
                  id="imageUrl"
                  {...form.register("imageUrl")}
                  className="rounded-lg"
                  placeholder="https://exemplo.com/foto-fazenda.jpg"
                />
              </details>
            </div>
          </div>
        </section>
        {step === 1 && (
          <section
            aria-label="Localização e área"
            className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]"
          >
            <div className="space-y-5">
              <p className="text-sm font-medium">Como deseja definir a área?</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={mapEditing}
                  aria-pressed={drawMode === "map"}
                  className={`justify-start gap-2 rounded-lg ${drawMode === "map" ? "border-primary/40 bg-primary/10 text-emerald-300" : ""}`}
                  onClick={() => setDrawMode("map")}
                >
                  <Map className="h-4 w-4" />
                  Desenhar no mapa
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={mapEditing}
                  aria-pressed={drawMode === "manual"}
                  className={`justify-start gap-2 rounded-lg ${drawMode === "manual" ? "border-primary/40 bg-primary/10 text-emerald-300" : ""}`}
                  onClick={() => {
                    setDrawMode("manual");
                    form.setValue("polygon", null);
                  }}
                >
                  <Keyboard className="h-4 w-4" />
                  Informar manualmente
                </Button>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {form.watch("polygon") ? "Área delimitada" : "Área informada"}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-primary">
                  {form.watch("sizeHa") > 0
                    ? formatAreaHa(form.watch("sizeHa"))
                    : "— ha"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {form.watch("polygon")
                    ? "Calculada a partir do limite desenhado."
                    : "Área da propriedade em hectares."}
                </p>
              </div>
              {(["sizeHa", "latitude", "longitude"] as const).map((field) =>
                form.formState.errors[field] ? (
                  <p
                    key={field}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {form.formState.errors[field]?.message}
                  </p>
                ) : null,
              )}
              {drawMode === "map" && (
                <details className="rounded-xl border border-border p-4 text-sm">
                  <summary className="cursor-pointer font-medium">
                    Detalhes da localização
                  </summary>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p>Latitude: {form.watch("latitude")}</p>
                    <p>Longitude: {form.watch("longitude")}</p>
                  </div>
                </details>
              )}
            </div>
            <div className="min-w-0 space-y-4">
              {" "}
              {drawMode === "map" ? (
                <Suspense
                  fallback={
                    <div className="w-full h-[300px] rounded-lg border border-border flex items-center justify-center bg-muted/30">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <PolygonMapPicker
                    onInteractionChange={setMapEditing}
                    onChange={handlePolygonChange}
                    initialCenter={
                      form.getValues("latitude") && form.getValues("longitude")
                        ? [
                            form.getValues("latitude"),
                            form.getValues("longitude"),
                          ]
                        : undefined
                    }
                    initialPolygon={
                      form.getValues("polygon")
                        ? (form.getValues("polygon") as [number, number][])
                        : undefined
                    }
                  />
                </Suspense>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="sizeHa">Área em hectares *</Label>
                    <Input
                      id="sizeHa"
                      type="number"
                      step="0.01"
                      {...form.register("sizeHa", { valueAsNumber: true })}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="latitude">Latitude *</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        {...form.register("latitude", { valueAsNumber: true })}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="longitude">Longitude *</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="0.000001"
                        {...form.register("longitude", { valueAsNumber: true })}
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
        <section hidden={step !== 2} aria-label="Cultivo e revisão">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-5">
              {" "}
              <div className="grid gap-2">
                <Label htmlFor="cropType">Cultura principal *</Label>
                <Select
                  onValueChange={(value) =>
                    form.setValue("cropType", value, { shouldValidate: true })
                  }
                  defaultValue={form.getValues("cropType") || undefined}
                  value={form.watch("cropType") || undefined}
                >
                  <SelectTrigger id="cropType" className="h-11 rounded-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Soja">🌱 Soja</SelectItem>
                    <SelectItem value="Milho">🌽 Milho</SelectItem>
                    <SelectItem value="Café">☕ Café</SelectItem>
                    <SelectItem value="Cana-de-açúcar">
                      🍬 Cana-de-açúcar
                    </SelectItem>
                    <SelectItem value="Algodão">🧶 Algodão</SelectItem>
                    <SelectItem value="Banana">🍌 Banana</SelectItem>
                    <SelectItem value="Fruticultura">
                      🍊 Fruticultura / Pomar
                    </SelectItem>
                    <SelectItem value="Hortifruti">
                      🥬 Hortifruti / Hortaliças
                    </SelectItem>
                    <SelectItem value="Trigo">🌾 Trigo</SelectItem>
                    <SelectItem value="Arroz">🍚 Arroz</SelectItem>
                    <SelectItem value="Feijão">🫘 Feijão</SelectItem>
                    <SelectItem value="Pastagem">🐄 Pastagem</SelectItem>
                    <SelectItem value="Eucalipto">🌳 Eucalipto</SelectItem>
                    <SelectItem value="Outro">📋 Outro</SelectItem>
                    {defaultValues?.cropType &&
                      ![
                        "Soja",
                        "Milho",
                        "Café",
                        "Cana-de-açúcar",
                        "Algodão",
                        "Banana",
                        "Fruticultura",
                        "Hortifruti",
                        "Trigo",
                        "Arroz",
                        "Feijão",
                        "Pastagem",
                        "Eucalipto",
                        "Outro",
                      ].includes(defaultValues.cropType) && (
                        <SelectItem value={defaultValues.cropType}>
                          {defaultValues.cropType}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
                {form.formState.errors.cropType && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.cropType.message}
                  </p>
                )}
              </div>{" "}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plantingDate">Data de plantio</Label>
                  <Input
                    id="plantingDate"
                    type="date"
                    {...form.register("plantingDate")}
                    className="rounded-lg"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="harvestDate">Previsão de colheita</Label>
                  <Input
                    id="harvestDate"
                    type="date"
                    {...form.register("harvestDate")}
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <Label htmlFor="cropStage">
                  Estágio observado em campo (opcional)
                </Label>
                <Input
                  id="cropStage"
                  value={stage}
                  maxLength={120}
                  placeholder="Ex.: V4, florescimento ou rebrota"
                  onChange={(event) => {
                    setStage(event.target.value);
                    setStageError("");
                  }}
                />
                <Label htmlFor="observedOn">Data da observação</Label>
                <Input
                  id="observedOn"
                  type="date"
                  value={observedOn}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => {
                    setObservedOn(event.target.value);
                    setStageError("");
                  }}
                />
                {stageError && (
                  <p role="alert" className="text-sm text-destructive">
                    {stageError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Registre o estágio confirmado na vistoria. Para remover o
                  registro, limpe os dois campos.
                </p>
              </div>
            </div>
            <aside className="self-start rounded-2xl border border-border bg-muted/20 p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Confira sua propriedade
              </p>
              <h4 className="mt-3 break-words text-2xl font-semibold tracking-tight">
                {form.watch("name") || "Nome não informado"}
              </h4>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-border pb-4">
                  <dt className="text-muted-foreground">Área</dt>
                  <dd className="font-medium">
                    {formatAreaHa(form.watch("sizeHa") || 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-4">
                  <dt className="text-muted-foreground">Cultura</dt>
                  <dd>{form.watch("cropType") || "Selecione a cultura"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Localização</dt>
                  <dd>
                    {form.watch("polygon")
                      ? "Limite desenhado"
                      : "Coordenadas manuais"}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                Você poderá atualizar essas informações a qualquer momento na
                edição da fazenda.
              </p>
            </aside>
          </div>
        </section>
      </div>
      <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4 sm:px-7">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <div className="flex items-center justify-end gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || mapEditing}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="mr-1 hidden h-4 w-4 sm:block" />
              Voltar
            </Button>
          )}
          {editing || step === 2 ? (
            <Button
              type="submit"
              disabled={busy || mapEditing}
              className="rounded-lg bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 hidden h-4 w-4 sm:block" />
              )}
              {isUploadingImage
                ? "Enviando foto..."
                : busy
                  ? "Salvando..."
                  : submitLabel}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={mapEditing}
              className="rounded-lg bg-emerald-700 text-white hover:bg-emerald-800"
            >
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
}

export function CreateFarmDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createFarm = useCreateFarm();

  const onSubmit = async (data: InsertFarm) => {
    try {
      await createFarm.mutateAsync(data);
      setOpen(false);
      toast({
        title: "Fazenda criada com sucesso!",
        description: `${data.name} foi adicionada.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar fazenda",
        description:
          error instanceof Error
            ? error.message
            : "Verifique os dados e tente novamente.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Nova Fazenda
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogClass}>
        <DialogHeader className="shrink-0 px-5 pb-5 pt-6 text-left sm:px-7">
          <DialogTitle className="text-2xl font-display">
            Nova fazenda
          </DialogTitle>
          <DialogDescription>
            Prepare sua propriedade para o monitoramento.
          </DialogDescription>
        </DialogHeader>
        <FarmForm
          onSubmit={onSubmit}
          onCancel={() => setOpen(false)}
          isPending={createFarm.isPending}
          submitLabel="Criar fazenda"
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditFarmDialog({
  farm,
  trigger,
}: {
  farm: Farm;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const updateFarm = useUpdateFarm();

  const onSubmit = async (data: InsertFarm) => {
    try {
      await updateFarm.mutateAsync({ id: farm.id, data });
      setOpen(false);
      toast({
        title: "Fazenda atualizada",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description:
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao tentar salvar.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar ${farm.name}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={dialogClass}>
        <DialogHeader className="shrink-0 px-5 pb-5 pt-6 text-left sm:px-7">
          <DialogTitle className="text-2xl font-display">
            Editar Fazenda
          </DialogTitle>
          <DialogDescription>
            Acesse uma seção e atualize os dados da propriedade.
          </DialogDescription>
        </DialogHeader>
        <FarmForm
          onSubmit={onSubmit}
          onCancel={() => setOpen(false)}
          isPending={updateFarm.isPending}
          submitLabel="Salvar alterações"
          defaultValues={{
            name: farm.name,
            cropType: farm.cropType,
            cropStage: farm.cropStage,
            sizeHa: farm.sizeHa,
            latitude: farm.latitude,
            longitude: farm.longitude,
            clientId: farm.clientId,
            imageUrl: farm.imageUrl,
            plantingDate: farm.plantingDate,
            harvestDate: farm.harvestDate,
            polygon: farm.polygon as [number, number][] | null,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
