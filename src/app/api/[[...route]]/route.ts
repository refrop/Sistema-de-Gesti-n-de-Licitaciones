import { app } from "@/server/api/app";

const handler = (req: Request) => app.fetch(req);

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
