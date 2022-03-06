import express from "express";
import getPort from "get-port";
import bodyParser from "body-parser";

const now = () => new Date().getTime();

export class MockLokiServer {
  constructor(opt = {}) {
    this.opt = Object.assign({ host: "127.0.0.1" }, opt);
    this.app = this.makeApp();
    this.server = null;
    this.log = [];
    this.statusQueue = [];
    this.resume();
  }

  pause() {
    this.waitFor = new Promise(resolve => (this.endWait = resolve));
  }

  resume() {
    if (this.endWait) this.endWait();
    this.endWait = null;
    this.waitFor = Promise.resolve();
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
      await this.waitFor;
      const ts = now();
      const status = this.statusQueue.shift() || 200;
      if (status >= 200 && status < 300) {
        this.log.push({ ts, payload: req.body });
      } else {
        this.log.push({ ts, payload: { status } });
      }
      res.status(status).json({ status });
    });
    return app;
  }

  getRawLog() {
    return this.log.splice(0);
  }

  consumeLog() {
    return this.getRawLog().map(({ payload }) => payload);
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
