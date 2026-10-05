import type {AddressInfo} from "node:net";
import type {Express} from "express";

export type ServedApp = {url: string; close: () => Promise<void>};

// Serves an Express app on an ephemeral port so unit tests can exercise it
// over real HTTP without the emulator.
export async function serveApp(app: Express): Promise<ServedApp> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const {port} = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
