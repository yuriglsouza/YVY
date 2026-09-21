import { z } from "zod";

export const cropStageSchema = z.object({
  stage: z.string().trim().min(1, "Informe o estágio observado.").max(120, "Use até 120 caracteres."),
  observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
    .refine(value => {
      const parsed = new Date(value + "T12:00:00Z");
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, "Informe uma data válida.")
    .refine(value => value <= new Date().toISOString().slice(0, 10), "A observação não pode estar no futuro."),
});
export type CropStage = z.infer<typeof cropStageSchema>;
