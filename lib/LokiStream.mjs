import { Writable } from "stream";
import { once } from "events";

import { LokiClient } from "./LokiClient.mjs";

const now = () => new Date().getTime();

const heartbeat = { __heartbeat: true };

export class LokiStream extends Writable {
  constructor(endPoint, opt) {
    const options = Object.assign({ maxAge: 1000, maxCount: 1000 }, opt || {});

    super({ highWaterMark: options.maxCount * 2, objectMode: true });

    this.opt = options;
    this.client = new LokiClient(endPoint, options);

    // The timestamp of the oldest message we have queued.
    this.oldest = null;

    // How many messages are queued
    this.count = 0;

    this.ts = now();
    this.ticker = null;

    this._startTicker();
  }

  _startTicker() {
    this.ticker = setInterval(() => {
      // Only update the time on ticks to avoid doing a
      // new Date().getTime() for every write.
      this.ts = now();
      // Send ourselves a heartbeat message so we have an opportunity
      // to flush if the oldest message is >= maxAge
      if (!this.write(heartbeat)) {
        // If we're full stop sending heartbeats until we've drained
        this._stopTicker();
        once(this, "drain").then(() => this._startTicker());
      }
    }, Math.max(this.opt.maxAge / 10, 100));
  }

  _stopTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  _flush(next) {
    const { client } = this;

    const cb = err => {
      // Reset our state before calling next(). Calling next()
      // will often cause an immediate call to _write() so we
      // need to be prepared.
      this.oldest = null;
      this.count = 0;
      next(err);
    };

    client.flush().then(() => cb(), cb);
  }

  _write(chunk, _enc, next) {
    const { opt, client, ts } = this;

    // Filter out heartbeats. We're only interested in them for their
    // side effect of checking whether we need to flush (opt.maxAge).
    if (chunk !== heartbeat) {
      const { message = "", ...labelSet } = chunk;
      client.labels(labelSet).log(message);
      this.count++;
      if (this.oldest === null) this.oldest = ts;
    }

    // Too full? Too old?
    const needFlush =
      this.count >= opt.maxCount ||
      (this.oldest !== null && ts - this.oldest >= opt.maxAge);

    if (needFlush) this._flush(next);
    else next();
  }

  _final(next) {
    this._stopTicker();
    this._flush(next);
  }
}
