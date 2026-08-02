# SPEC 03 — Integración de Supabase

> **Estado:** Aprobado
> **Depende de:** [02-about-contact](02-about-contact.md)
> **Fecha:** 2026-08-02
> **Objetivo:** Conectar la app Next.js con el proyecto Supabase mediante `@supabase/ssr`, dejando clientes de navegador y servidor, refresco de sesión y un endpoint de diagnóstico funcionando.

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- `lib/supabase/client.ts` — cliente de navegador (`createBrowserClient`).
- `lib/supabase/server.ts` — cliente de servidor (`createServerClient` + `cookies()` de `next/headers`), `async`.
- `lib/supabase/proxy.ts` — `updateSession(request)` que refresca la sesión y propaga cookies y cache headers.
- `proxy.ts` en la raíz — exporta `proxy` delegando en `updateSession`, con `matcher` que excluye estáticos.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`, documentadas en `.env.template`.
- `app/api/health/supabase/route.ts` — GET de diagnóstico que instancia el cliente de servidor y devuelve `{ ok: true, user: null }` o `{ ok: false, error }`.

**Out of scope (para specs futuras):**

- Autenticación real. `app/auth/page.tsx` y `app/providers.tsx` (mock con localStorage) **quedan intactos**.
- Tabla `profiles` y username.
- Tablas de juegos y puntajes, y sus políticas RLS.
- Protección de rutas / redirecciones por sesión.
- Realtime y edge functions.
- Migraciones de esquema (esta spec no crea ninguna tabla).

## Data model

Esta spec no introduce estructuras de datos persistentes ni tablas. Solo el tipo de respuesta del endpoint de diagnóstico, local a su archivo:

```ts
type HealthResponse =
  { ok: true; user: string | null } | { ok: false; error: string };
```

## Implementation plan

1. `npm install @supabase/supabase-js @supabase/ssr`.
2. Agregar a `.env.local` (no versionado):
   - `NEXT_PUBLIC_SUPABASE_URL=https://hfeqiasijgetkpfsvzsm.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_pHsFl-Vhc9XUz8458FLczg_UaimF4eb`

   Documentar ambas (con valor vacío) en `.env.template`, junto al `RESEND_API_KEY` existente.

3. Crear `lib/supabase/client.ts`: exporta `createClient()` con `createBrowserClient(url, key)`.
4. Crear `lib/supabase/server.ts`: exporta `async createClient()` con `createServerClient`, `cookies.getAll()` desde `cookieStore`, y `setAll` envuelto en `try/catch` (ignora el error cuando lo llama un Server Component).
5. Crear `lib/supabase/proxy.ts` con `updateSession(request)` según el patrón oficial: crear `NextResponse.next({ request })`, cliente con `getAll`/`setAll` que reescribe cookies y aplica los cache headers a la respuesta, llamar a `supabase.auth.getClaims()` sin código intermedio, y devolver `supabaseResponse` sin modificar. **Sin el bloque de redirección a login** — ninguna ruta se protege en esta spec.
6. Crear `proxy.ts` en la raíz: `export async function proxy(request: NextRequest) { return await updateSession(request); }` más `config.matcher` `'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'`.
7. Crear `app/api/health/supabase/route.ts`: GET que instancia el cliente de servidor, llama a `supabase.auth.getUser()` y devuelve `{ ok: true, user: data.user?.id ?? null }`; ante excepción, `{ ok: false, error }` con status 500.
8. Verificar: `npm run dev`, abrir `/api/health/supabase` y confirmar `{ ok: true, user: null }`; navegar por `/`, `/games`, `/about` y comprobar que no hay errores en consola ni redirecciones inesperadas. Cerrar con `npm run build` y `npm run lint`.

## Acceptance criteria

- [ ] `@supabase/supabase-js` y `@supabase/ssr` figuran en `package.json` e instalan sin errores.
- [ ] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/proxy.ts`.
- [ ] Existe `proxy.ts` en la raíz (no `middleware.ts`, deprecado en Next 16).
- [ ] `GET /api/health/supabase` responde `{ ok: true, user: null }` con status 200 en una sesión anónima.
- [ ] Si la key es inválida o falta, el endpoint responde `{ ok: false, error }` con status 500 y la app no se cae.
- [ ] Navegar `/`, `/games`, `/salon`, `/about` y `/auth` sigue funcionando igual que antes, sin redirecciones ni errores de consola.
- [ ] `app/auth/page.tsx` y `app/providers.tsx` no fueron modificados.
- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] Ninguna key ni URL de Supabase queda versionada en git salvo los nombres de variable en `.env.template`.

## Decisions

- **Sí:** `@supabase/ssr` con clientes separados de navegador y servidor. Es el patrón oficial para App Router y habilita datos en Server Components más adelante.
- **Sí:** `proxy.ts` en vez de `middleware.ts`. Next 16 marcó `middleware` como deprecado y renombrado a `proxy`; la doc de Supabase ya usa esta convención.
- **Sí:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) en vez de la anon key legacy. Es la nomenclatura vigente; la legacy sigue existiendo pero está en camino de deprecación.
- **Sí:** `updateSession` sin redirección a login. Ninguna ruta se protege todavía; incluir el redirect del ejemplo oficial rompería la navegación anónima actual.
- **Sí:** Endpoint de diagnóstico permanente en lugar de una página temporal. Verifica las credenciales en runtime y sirve para depurar despliegues.
- **No:** Tocar `app/auth/page.tsx` ni `app/providers.tsx`. Decisión explícita del usuario: esta spec es solo la conexión; el mock de localStorage se reemplaza en la spec de auth.
- **No:** Crear tablas o migraciones. Sin modelo de datos definido todavía; las migraciones se aplicarán vía MCP `apply_migration` cuando exista la spec correspondiente.
- **No:** Service role key. No hay ningún caso de uso que requiera saltarse RLS.

## Identified risks

- **`getClaims()` en cada request:** `proxy.ts` corre en casi todas las rutas y valida el JWT. Con sesión anónima el costo es mínimo, pero conviene revisar el `matcher` si aparecen rutas de alto tráfico que no necesitan sesión.
- **Keys faltantes en despliegue:** si `NEXT_PUBLIC_SUPABASE_*` no se configuran en producción (ej. Vercel), `proxy.ts` falla en toda la app, no solo en el endpoint. Mitigación: verificar el health-check inmediatamente después de cada despliegue.
- **Confusión de convenciones:** buena parte de la documentación y los ejemplos que circulan usan `middleware.ts` y `ANON_KEY`. Copiar ese código en este proyecto lo rompería en silencio.
