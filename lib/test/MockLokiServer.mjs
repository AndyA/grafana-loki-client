import express from "express";
import getPort from "get-port";
import bodyParser from "body-parser";

export class MockLokiServer {
  constructor(opt = {}) {
    this.opt = Object.assign({ host: "127.0.0.1" }, opt);
    this.app = this.makeApp();
    this.server = null;
    this.log = [];
    this.statusQueue = [];
  }

  nextStatus(...status) {
    this.statusQueue = status.flat();
    return this;
  }

  makeApp() {
    const app = express();
    app.use(bodyParser.json({ type: "application/json" }));
    app.get("/status", async (req, res) => res.json({ ok: true }));
    app.post("/loki/api/v1/push", async (req, res) => {
      const status = this.statusQueue.shift() || 200;
      if (status >= 200 && status < 300) {
        const payload = req.body;
        this.log.push(payload);
      } else {
        this.log.push({ status });
      }
      res.status(status).json({ status });
    });
    return app;
  }

  consumeLog() {
    const log = this.log;
    this.log = [];
    return log;
  }

  async start() {
    const { app, opt } = this;
    // if (this.server) throw new Error(`Already runnning`);
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
