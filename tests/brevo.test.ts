import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { resendSendMock, fetchMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

type SendEmail = (opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
  idempotencyKey?: string;
}) => Promise<string>;

// Recarga el módulo con las variables puestas (env.ts se evalúa al importar)
async function loadSendEmail(overrides: Record<string, string | undefined>): Promise<SendEmail> {
  vi.resetModules();
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    const mod = await import("../src/server/lib/email");
    return mod.sendEmail;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

beforeEach(() => {
  resendSendMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Brevo (EMAIL_PROVIDER=brevo)", () => {
  it("envía el body correcto (sender, destinatario, adjunto base64) y devuelve el messageId", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ messageId: "<brevo-123@relay.brevo>" }),
    });
    const sendEmail = await loadSendEmail({
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "brevo-test-key",
      EMAIL_FROM: '"Sistema de Licitaciones <no-reply@test.local>"',
    });

    const pdf = Buffer.from("%PDF-1.4 evidencia");
    const id = await sendEmail({
      to: "cliente@otro-correo.com",
      subject: "Licitación: Expediente X",
      html: "<p>hola</p>",
      attachments: [{ filename: "propuesta.pdf", content: pdf }],
      idempotencyKey: "tender-1-envio",
    });

    expect(id).toBe("<brevo-123@relay.brevo>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("brevo-test-key");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({ name: "Sistema de Licitaciones", email: "no-reply@test.local" });
    expect(body.to).toEqual([{ email: "cliente@otro-correo.com" }]);
    expect(body.subject).toBe("Licitación: Expediente X");
    expect(body.htmlContent).toBe("<p>hola</p>");
    expect(body.attachment).toEqual([{ name: "propuesta.pdf", content: pdf.toString("base64") }]);
    // Sin dominio propio no hace falta redirección: va al destinatario original
    // aunque EMAIL_REDIRECT_TO esté definido en el entorno.
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("mapea un error de la API a EMAIL_FAILED (502)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: "invalid_parameter", message: "sender is not verified" }),
    });
    const sendEmail = await loadSendEmail({
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "brevo-test-key",
      EMAIL_FROM: "no-reply@test.local",
    });

    const err = await sendEmail({ to: "cliente@x.com", subject: "s", html: "<p>x</p>" }).catch((e) => e);
    expect(err).toMatchObject({ code: "EMAIL_FAILED", status: 502 });
    expect(err.message).toContain("HTTP 400");
    expect(err.message).toContain("sender is not verified");
  });

  it("falla claro al arrancar si falta BREVO_API_KEY con EMAIL_PROVIDER=brevo", async () => {
    await expect(
      loadSendEmail({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: undefined }),
    ).rejects.toThrow(/BREVO_API_KEY/);
  });

  it("por defecto (sin EMAIL_PROVIDER) sigue usando Resend", async () => {
    resendSendMock.mockResolvedValue({ data: { id: "msg-resend-1" }, error: null });
    const sendEmail = await loadSendEmail({ EMAIL_PROVIDER: undefined, BREVO_API_KEY: undefined });

    const id = await sendEmail({ to: "cliente@x.com", subject: "Hola", html: "<p>h</p>" });
    expect(id).toBe("msg-resend-1");
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
