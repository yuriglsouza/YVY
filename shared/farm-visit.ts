import { z } from 'zod';
import { cropStageSchema } from './crop-stage.js';

export const visitInputSchema = z.object({
  observedOn: cropStageSchema.shape.observedOn,
  stage: z.string().trim().max(120).default(''),
  observations: z.string().trim().min(1, 'Descreva o que foi observado na visita.').max(4000),
  management: z.string().trim().max(4000).default(''),
  photoPaths: z.array(z.string().max(250)).max(4, 'Use no máximo quatro fotos.').default([]),
}).strict();
export type VisitInput = z.infer<typeof visitInputSchema>;

export function ownsVisitPhoto(path: string, farmId: number, userId: number): boolean {
  return new RegExp(`^${farmId}/${userId}/[a-f0-9-]{36}\\.(jpg|png|webp)$`).test(path);
}

export function visitReportContext(visits: Array<{observedOn: string; stage: string; observations: string; management: string}>) {
  return JSON.stringify(visits.slice(0, 5).map(({ observedOn, stage, observations, management }) => ({
    observedOn, stage, observations, management,
  })));
}
