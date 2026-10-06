import { OpenAPIHono } from "@hono/zod-openapi";
import { onError } from "./middleware/errors";
import { systemRoutes } from "./routes/system";
import { spikeRoutes } from "./routes/spike";

export const app = new OpenAPIHono().onError(onError);

app.route("/", systemRoutes);
app.route("/", spikeRoutes);

export type AppType = typeof app;
