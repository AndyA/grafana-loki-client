import express from "express";
import getPort from "get-port";

export class MockLokiServer {
  constructor(opt = {}) {
    this.opt = Object.assign({ host: "127.0.0.1" }, opt);
    this.app = this.makeApp();
    this.server = null;
  }

  makeApp() {
    const app = express();
    app.get("/status", async (req, res) => res.json({ ok: true }));
    app.post("/loki/api/v1/push", async (req, res) => res.json({ ok: true }));
    return app;
  }

  async start() {
    const { app, opt } = this;
    if (this.server) throw new Error(`Already runnning`);
    const port = await getPort();
    this.server = app.listen(port);
    return `http://${opt.host}:${port}`;
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
