# SPEC 02 — About page & contact form

> **Estado:** aprobado
> **Depende de:** [01-home-landing](01-home-landing.md)
> **Fecha:** 2026-07-30
> **Objetivo:** Implementar la página "Acerca de" con formulario de contacto (según `references/templates/home-about/about.jsx`) que envía correos vía Resend a `fedef0188@gmail.com`.

## Scope

**In:**

- Nueva página `app/about/page.tsx` (ruta `/about`), basada en `references/templates/home-about/about.jsx`: hero "Acerca de", highlights, divider, sección contacto con formulario.
- Estados del formulario: idle → loading (mientras envía) → success (pantalla terminal `terminal-success`, igual al template) → error (mismo panel terminal, línea roja tipo "ERROR AL ENVIAR. INTENTA DE NUEVO.").
- Validación: campos no vacíos (`trim()`), igual que el template. Sin validación de formato de email.
- `app/api/contact/route.ts`: Route Handler POST que recibe `{ name, email, msg }`, envía correo vía Resend a `fedef0188@gmail.com`, `from: onboarding@resend.dev`, `replyTo: email` del formulario, asunto `Nuevo mensaje de contacto — Arcade Vault`, cuerpo con nombre/email/mensaje.
- Dependencia `resend` agregada a `package.json`.
- `RESEND_API_KEY` leída desde `.env.local` (no versionado, ya cubierto por `.env*` en `.gitignore`).
- `components/nav.tsx`: agregar link "Acerca de" → `/about` (desktop y menú mobile), con `isActive` correspondiente.
- Estilos de `about.jsx` portados desde `references/templates/home-about/styles.css` (secciones `.about-*`, `.highlight-*`, `.contact-*`, `.terminal-success`) a `app/globals.css`, reutilizando variables de tema existentes.

**Out of scope (para specs futuras):**

- Dominio verificado en Resend / dirección `from` propia (queda `onboarding@resend.dev` por ahora).
- Protección anti-spam (honeypot, rate limiting, captcha).
- Persistencia de mensajes enviados (no se guardan en DB).
- Validación de formato de email.

## Data model

Sin estructuras de datos persistentes nuevas. Solo tipos de request/response del endpoint, locales a `app/api/contact/route.ts` y `app/about/page.tsx`:

```ts
// Request body — POST /api/contact
type ContactRequest = {
  name: string;
  email: string;
  msg: string;
};

// Response
type ContactResponse =
  | { ok: true }
  | { ok: false; error: string };
```

Estado local del formulario en `app/about/page.tsx` (no persistido, se pierde al recargar):

```ts
type FormState = { name: string; email: string; msg: string };
type SendStatus = "idle" | "loading" | "success" | "error";
```

## Implementation plan

1. Instalar dependencia `resend` (`npm install resend`).
2. Agregar `RESEND_API_KEY` a `.env.local` (valor real del usuario, no versionado) y documentar la variable en `.env.example` si no existe, o crearlo.
3. Crear `app/api/contact/route.ts`: Route Handler `POST`, valida body (`name`/`email`/`msg` no vacíos), llama a Resend (`from: "onboarding@resend.dev"`, `to: "fedef0188@gmail.com"`, `replyTo: email`, `subject: "Nuevo mensaje de contacto — Arcade Vault"`, cuerpo con los 3 campos), devuelve `{ ok: true }` o `{ ok: false, error }` con status apropiado.
4. Crear `app/about/page.tsx`: portar `about.jsx` a TSX (client component), estado `FormState` + `SendStatus`, `onSubmit` hace `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })`, maneja `loading` → `success`/`error`. Mantener animación `reveal`/`IntersectionObserver` y `shake` en validación vacía, igual que el template.
5. Portar estilos `.about-*`, `.highlight-*`, `.contact-*`, `.terminal-success` de `references/templates/home-about/styles.css` a `app/globals.css`.
6. Actualizar `components/nav.tsx`: agregar link "Acerca de" → `/about` en desktop (`.links`) y mobile (`.av-mobile-panel`), con `isActive("/about")`.
7. Verificar manualmente: enviar formulario con datos reales, confirmar llegada del correo a `fedef0188@gmail.com` con `reply-to` correcto; probar caso error (ej. API key inválida temporalmente) y confirmar que se muestra el estado de error.

## Acceptance criteria

- [ ] `/about` muestra la página "Acerca de" (hero, highlights, divider, formulario contacto) sin errores en consola.
- [ ] Nav muestra link "Acerca de" (desktop y mobile), resalta activo en `/about`.
- [ ] Enviar el formulario con campos vacíos dispara el `shake` y no envía nada.
- [ ] Enviar el formulario con datos válidos muestra estado `loading` en el botón mientras se procesa.
- [ ] Envío exitoso llega como correo real a `fedef0188@gmail.com`, con asunto `Nuevo mensaje de contacto — Arcade Vault`, cuerpo con nombre/email/mensaje, y `reply-to` = email del formulario.
- [ ] Envío exitoso muestra la pantalla `terminal-success` igual al template, con botón "ENVIAR OTRO MENSAJE" que resetea el formulario.
- [ ] Si el envío falla (error de Resend/red), se muestra estado de error visible dentro del panel terminal, sin romper la página.
- [ ] `RESEND_API_KEY` no queda hardcodeada en el código ni versionada en git.
- [ ] Página responsive, no rompe layout en mobile.

## Decisions

- **Sí:** Usar Resend para envío de correo. Pedido explícito del usuario.
- **Sí:** `from: onboarding@resend.dev` por ahora (sandbox, sin dominio verificado). Se reemplaza por dirección propia cuando haya dominio verificado en Resend — otra spec/ajuste menor a futuro.
- **Sí:** `RESEND_API_KEY` en `.env.local`, no versionada. Estándar de seguridad, ya cubierto por `.gitignore` (`.env*`).
- **Sí:** `email` del formulario como `replyTo`. Permite responder directo desde el cliente de correo sin exponer lógica extra.
- **Sí:** Agregar estado `loading` y `error` explícitos, más allá del `sent` que traía el template. Sin esto, un fallo de red queda mudo — mala UX.
- **No:** Validación de formato de email (regex). Mismo criterio que el template (solo `trim()` no vacío); mantiene paridad exacta con el diseño de referencia.
- **No:** Protección anti-spam (honeypot, rate limit, captcha). Fuera de scope — se evalúa en spec separada si se vuelve necesario.
- **No:** Persistencia de mensajes en DB. No hay requerimiento de guardar histórico de contactos todavía.

## Identified risks

- **Restricción de sandbox Resend:** sin dominio verificado, Resend solo permite enviar a la dirección con la que se registró la cuenta. Si `fedef0188@gmail.com` no es esa dirección, el envío falla en producción real. Mitigación: usuario confirma que es su cuenta de Resend.
- **API key inválida/faltante en despliegue:** si `RESEND_API_KEY` no se configura en el entorno de producción (ej. Vercel), el endpoint falla silenciosamente para el usuario final salvo por el estado de error ya contemplado.
