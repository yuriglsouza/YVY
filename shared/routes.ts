import { z } from 'zod';
import { insertFarmSchema, insertReadingSchema, farms, readings, reports } from './schema.js';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  farms: {
    list: {
      method: 'GET' as const,
      path: '/api/farms',
      responses: {
        200: z.array(z.custom<typeof farms.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/farms/:id',
      responses: {
        200: z.custom<typeof farms.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/farms',
      input: insertFarmSchema,
      responses: {
        201: z.custom<typeof farms.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    // Mock endpoint to trigger satellite data fetch/generation
    refreshReadings: {
      method: 'POST' as const,
      path: '/api/farms/:id/refresh',
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    }
  },
  readings: {
    list: {
      method: 'GET' as const,
      path: '/api/farms/:id/readings',
      responses: {
        200: z.array(z.custom<typeof readings.$inferSelect>()),
      },
    },
    latest: {
      method: 'GET' as const,
      path: '/api/farms/:id/readings/latest',
      responses: {
        200: z.custom<typeof readings.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  reports: {
    list: {
      method: 'GET' as const,
      path: '/api/farms/:id/reports',
      responses: {
        200: z.array(z.custom<typeof reports.$inferSelect>()),
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/farms/:id/reports/generate',
      responses: {
        201: z.custom<typeof reports.$inferSelect>(),
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
