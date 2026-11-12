import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

const startServer = async (): Promise<void> => {
  try {
    // 1. Establish database connection
    await connectDatabase();

    // 2. Start Express HTTP server
    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log(
        `[EMS Server] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`
      );
    });

    // 3. Graceful shutdown handler
    const handleShutdown = async (signal: string) => {
      console.log(`\n[EMS Server] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log("[EMS Server] HTTP server closed.");
        try {
          await disconnectDatabase();
          process.exit(0);
        } catch (err) {
          console.error("[EMS Server] Error during database disconnect:", err);
          process.exit(1);
        }
      });

      // Force terminate after 10s timeout
      setTimeout(() => {
        console.error("[EMS Server] Forced termination due to timeout.");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
  } catch (error) {
    console.error("[EMS Server] Startup initialization failed:", error);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
};

startServer();
