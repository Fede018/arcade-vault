import { Resend } from "resend";

type ContactRequest = {
  name: string;
  email: string;
  msg: string;
};

type ContactResponse = { ok: true } | { ok: false; error: string };

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactRequest>;
  const name = body.name?.trim();
  const email = body.email?.trim();
  const msg = body.msg?.trim();

  if (!name || !email || !msg) {
    return Response.json(
      { ok: false, error: "Faltan campos requeridos." } satisfies ContactResponse,
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "fedef0188@gmail.com",
    replyTo: email,
    subject: "Nuevo mensaje de contacto — Arcade Vault",
    text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${msg}`,
  });

  if (error) {
    return Response.json(
      { ok: false, error: error.message } satisfies ContactResponse,
      { status: 502 }
    );
  }

  return Response.json({ ok: true } satisfies ContactResponse);
}
