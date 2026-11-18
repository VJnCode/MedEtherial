import type { Permission } from '@medetherial/shared';
import type { Request, RequestHandler, Response, Router } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { authenticate, requirePermission } from '../auth/middleware.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteSpec<B extends ZodTypeAny, Q extends ZodTypeAny, P extends ZodTypeAny> {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  /** Omit for public endpoints. Any one of the listed permissions grants access. */
  permissions?: Permission[];
  auth?: boolean;
  body?: B;
  query?: Q;
  params?: P;
}

export interface Ctx<B, Q, P> {
  req: Request;
  res: Response;
  body: B;
  query: Q;
  params: P;
}

interface DocEntry {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  secured: boolean;
  permissions?: Permission[];
  body?: ZodTypeAny;
  query?: ZodTypeAny;
}
export const registry: DocEntry[] = [];

/**
 * Declarative route: auth + permission check + zod validation + OpenAPI registration in one place.
 * The handler's return value is sent as JSON (201 for POST).
 */
export function defineRoute<
  B extends ZodTypeAny = z.ZodUnknown,
  Q extends ZodTypeAny = z.ZodUnknown,
  P extends ZodTypeAny = z.ZodUnknown,
>(
  router: Router,
  basePath: string,
  spec: RouteSpec<B, Q, P>,
  handler: (ctx: Ctx<z.infer<B>, z.infer<Q>, z.infer<P>>) => Promise<unknown>,
) {
  const secured = spec.auth !== false;
  registry.push({
    method: spec.method,
    path: (basePath + spec.path).replace(/(.)\/$/, '$1'),
    summary: spec.summary,
    tag: spec.tag,
    secured,
    permissions: spec.permissions,
    body: spec.body,
    query: spec.query,
  });

  const chain: RequestHandler[] = [];
  if (secured) chain.push(authenticate);
  if (spec.permissions?.length) chain.push(requirePermission(...spec.permissions));
  chain.push(async (req, res) => {
    const body = spec.body ? spec.body.parse(req.body) : req.body;
    const query = spec.query ? spec.query.parse(req.query) : req.query;
    const params = spec.params ? spec.params.parse(req.params) : req.params;
    const result = await handler({ req, res, body, query, params });
    if (res.headersSent) return;
    if (result === undefined) {
      res.status(204).end();
      return;
    }
    res.status(spec.method === 'post' ? 201 : 200).json(result);
  });
  router[spec.method](spec.path, ...chain);
}

export function buildOpenApi(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of registry) {
    const oaPath = r.path.replace(/:(\w+)/g, '{$1}');
    const params = [...r.path.matchAll(/:(\w+)/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const queryParams: unknown[] = [];
    if (r.query) {
      const js = zodToJsonSchema(r.query, { target: 'openApi3' }) as { properties?: Record<string, unknown> };
      for (const [name, schema] of Object.entries(js.properties ?? {})) {
        queryParams.push({ name, in: 'query', required: false, schema });
      }
    }
    paths[oaPath] ??= {};
    paths[oaPath]![r.method] = {
      tags: [r.tag],
      summary: r.summary,
      description: r.permissions?.length ? `Requires one of: \`${r.permissions.join('`, `')}\`` : undefined,
      security: r.secured ? [{ oidc: [] }, { bearer: [] }] : [],
      parameters: [...params, ...queryParams],
      ...(r.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: zodToJsonSchema(r.body, { target: 'openApi3' }) } },
            },
          }
        : {}),
      responses: {
        '200': { description: 'OK' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden' },
        '422': { description: 'Validation failed' },
      },
    };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'MedEtherial API',
      version: '1.0.0',
      description: 'Patient care, appointments and ambulance dispatch with live GPS tracking.',
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        oidc: { type: 'openIdConnect', openIdConnectUrl: '/.well-known/openid-configuration' },
      },
    },
    paths,
  };
}

export const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });
