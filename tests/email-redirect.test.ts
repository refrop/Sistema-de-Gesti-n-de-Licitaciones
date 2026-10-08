import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

type SendEmail = (opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
  idempotencyKey?: string;
}) => Promise<string>;

// Recarga el módulo con la variable puesta (env.ts se evalúa al importar)
async function loadSendEmail(redirect: string | undefined): Promise<SendEmail> {
  vi.resetModules();
  const previous = process.env.EMAIL_REDIRECT_TO;
  if (redirect === undefined) delete process.env.EMAIL_REDIRECT_TO;
  else process.env.EMAIL_REDIRECT_TO = redirect;
  const mod = await import("../src/server/lib/email");
  if (previous === undefined) delete process.env.EMAIL_REDIRECT_TO;
  else process.env.EMAIL_REDIRECT_TO = previous;
  return mod.sendEmail;
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "msg-redirect-test" }, error: null });
});

describe("EMAIL_REDIRECT_TO (remitente sin dominio verificado)", () => {
  it("sin la variable envía al destinatario original y sin nota", async () => {
    const sendEmail = await loadSendEmail(undefined);
    await sendEmail({ to: "cliente@demo.com", subject: "Hola", html: "<p>hola</p>" });

    const [payload] = sendMock.mock.calls[0];
    expect(payload.to).toBe("cliente@demo.com");
    expect(payload.html).toBe("<p>hola</p>");
  });

  it("con la variable envía al titular y documenta el original en el cuerpo", async () => {
    const sendEmail = await loadSendEmail("titular@ejemplo.com");
    await sendEmail({ to: "cliente@demo.com", subject: "Hola", html: "<p>hola</p>" });

    const [payload] = sendMock.mock.calls[0];
    expect(payload.to).toBe("titular@ejemplo.com");
    expect(payload.html).toContain("Destinatario original");
    expect(payload.html).toContain("cliente@demo.com");
    expect(payload.html).toContain("<p>hola</p>");
  });

  it("si el destinatario ya es el titular no añade la nota", async () => {
    const sendEmail = await loadSendEmail("titular@ejemplo.com");
    await sendEmail({ to: "titular@ejemplo.com", subject: "Hola", html: "<p>hola</p>" });

    const [payload] = sendMock.mock.calls[0];
    expect(payload.to).toBe("titular@ejemplo.com");
    expect(payload.html).toBe("<p>hola</p>");
  });

  it("escapa el destinatario original antes de meterlo en el HTML", async () => {
    const sendEmail = await loadSendEmail("titular@ejemplo.com");
    await sendEmail({
      to: "<b>cliente</b>@demo.com",
      subject: "Hola",
      html: "<p>hola</p>",
    });

    const [payload] = sendMock.mock.calls[0];
    expect(payload.html).toContain("&lt;b&gt;cliente&lt;/b&gt;@demo.com");
    expect(payload.html).not.toContain("<b>cliente</b>@demo.com");
  });
});
