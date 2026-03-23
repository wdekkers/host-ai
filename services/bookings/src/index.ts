import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 4002);
const host = process.env.HOST ?? "0.0.0.0";

const start = async (): Promise<void> => {
  process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection", error);
  });
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception", error);
  });

  console.log("Starting bookings service", { host, port });
  const app = await buildServer();
  try {
    await app.listen({ port, host });
    console.log("Service listening", { host, port });
  } catch (error) {
    app.log.error({ error }, "Failed to start server");
    process.exit(1);
  }
};

void start();
