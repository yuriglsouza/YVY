const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function localDateOnly(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface CropCycleSummary {
  status: "missing" | "planned" | "active" | "overdue" | "invalid";
  label: string;
  phaseLabel: string;
  progressPercent: number | null;
  daysElapsed: number | null;
  daysRemaining: number | null;
}

export function getCropCycleSummary(
  plantingDate?: string | null,
  harvestDate?: string | null,
  today = new Date(),
): CropCycleSummary {
  const planting = plantingDate ? parseDateOnly(plantingDate) : null;
  const harvest = harvestDate ? parseDateOnly(harvestDate) : null;
  const current = localDateOnly(today);

  if (planting === null && harvest === null) {
    return {
      status: "missing",
      label: "Datas não informadas",
      phaseLabel: "Cadastre o plantio e a colheita prevista",
      progressPercent: null,
      daysElapsed: null,
      daysRemaining: null,
    };
  }

  if (
    (plantingDate && planting === null) ||
    (harvestDate && harvest === null) ||
    (planting !== null && harvest !== null && harvest < planting)
  ) {
    return {
      status: "invalid",
      label: "Datas inconsistentes",
      phaseLabel: "Revise o período cadastrado",
      progressPercent: null,
      daysElapsed: null,
      daysRemaining: null,
    };
  }

  if (planting !== null && current < planting) {
    return {
      status: "planned",
      label: "Plantio planejado",
      phaseLabel: `Faltam ${Math.ceil((planting - current) / DAY_MS)} dias para o plantio`,
      progressPercent: 0,
      daysElapsed: 0,
      daysRemaining: harvest !== null ? Math.ceil((harvest - current) / DAY_MS) : null,
    };
  }

  if (harvest !== null && current > harvest) {
    return {
      status: "overdue",
      label: "Previsão de colheita ultrapassada",
      phaseLabel: "Confirme a colheita ou atualize a previsão",
      progressPercent: 100,
      daysElapsed: planting !== null ? Math.floor((current - planting) / DAY_MS) : null,
      daysRemaining: 0,
    };
  }

  if (planting !== null && harvest !== null) {
    const totalDays = Math.max(1, Math.round((harvest - planting) / DAY_MS));
    const elapsed = Math.max(0, Math.floor((current - planting) / DAY_MS));
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
    const phaseLabel = progressPercent < 25
      ? "Início do ciclo"
      : progressPercent < 75
        ? "Meio do ciclo"
        : "Final do ciclo";

    return {
      status: "active",
      label: "Ciclo em andamento",
      phaseLabel,
      progressPercent,
      daysElapsed: elapsed,
      daysRemaining: Math.max(0, Math.ceil((harvest - current) / DAY_MS)),
    };
  }

  if (planting !== null) {
    return {
      status: "active",
      label: "Ciclo em andamento",
      phaseLabel: "Colheita prevista não informada",
      progressPercent: null,
      daysElapsed: Math.max(0, Math.floor((current - planting) / DAY_MS)),
      daysRemaining: null,
    };
  }

  return {
    status: "planned",
    label: "Colheita prevista",
    phaseLabel: `Faltam ${Math.max(0, Math.ceil((harvest! - current) / DAY_MS))} dias`,
    progressPercent: null,
    daysElapsed: null,
    daysRemaining: Math.max(0, Math.ceil((harvest! - current) / DAY_MS)),
  };
}

export interface ApplicationWeatherInput {
  temperatureC: number;
  humidityPercent: number;
  windKmh: number;
  rainMm: number;
}

export interface ApplicationWeatherAssessment {
  status: "compatible" | "attention";
  checks: {
    temperature: boolean;
    humidity: boolean;
    wind: boolean;
    rain: boolean;
  };
}

export function assessApplicationWeather(input: ApplicationWeatherInput): ApplicationWeatherAssessment {
  const checks = {
    temperature: Number.isFinite(input.temperatureC) && input.temperatureC <= 30,
    humidity: Number.isFinite(input.humidityPercent) && input.humidityPercent >= 65,
    wind: Number.isFinite(input.windKmh) && input.windKmh >= 3.2 && input.windKmh <= 8,
    rain: Number.isFinite(input.rainMm) && input.rainMm <= 0,
  };

  return {
    status: Object.values(checks).every(Boolean) ? "compatible" : "attention",
    checks,
  };
}
