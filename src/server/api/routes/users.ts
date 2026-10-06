import { Hono } from "hono";
import { z } from "zod";
import { requireRole } from "../middleware/auth";
import { readJsonBody } from "../guard";
import { listQuerySchema } from "../../lib/pagination";
import { listUsers, createUser } from "../../services/users.service";

const createUserSchema = z.object({
  email: z.email("Correo inválido"),
  name: z.string().trim().min(1, "Nombre obligatorio"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["admin", "user"]).default("user"),
});

export const userRoutes = new Hono()
  .use("/api/users", requireRole("admin"))
  .get("/api/users", async (c) => {
    const query = listQuerySchema.parse(c.req.query());
    return c.json(await listUsers(query));
  })
  .post("/api/users", async (c) => {
    const body = await readJsonBody(c, createUserSchema);
    const user = await createUser(body, c.get("user").id);
    return c.json(user, 201);
  });
