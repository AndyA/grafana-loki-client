import { Writable } from "stream";
import { LokiClient } from "./LokiClient.mjs";

const now = () => new Date().getTime();

export class LokiStream extends Writable {
  constructor(endPoint, opt) {
    const options = Object.assign({ maxAge: 1000, maxCount: 1000 }, opt || {});
    super({ highWaterMark: options.maxCount * 2, objectMode: true });
    this.client = new LokiClient(endPoint, options);
    this.opt = options;

    this.oldest = null;
    this.count = 0;

    this.ticker = null;
    this.ts = now();

    this._startTicker();
  }

  _startTicker() {
    this.ticker = setInterval(() => {
      // Only update the time on ticks to avoid doing a
      // new Date().getTime() for every write.
      this.ts = now();
      // Send ourselves a heartbeat message so we have an opportunity
      // to flush if the oldest message is >= maxAge
      this.write({ __heartbeat: true });
    }, Math.max(this.opt.maxAge / 10, 100));
  }

  _stopTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  _reset() {
    this.oldest = null;
    this.count = 0;
  }

  _flush(next) {
    const { client } = this;

    const cb = err => {
      // Reset our state before calling next(). Calling next()
      // will often cause an immediate call to _write() so we
      // need to be prepared.
      this._reset();
      next(err);
    };

    client.flush().then(() => cb(), cb);
  }

  _write(chunk, _enc, next) {
    const { opt, client, ts } = this;

    // Allow messages containing __heartbeat so that we can
    // flush periodically even if there are no new messages
    // from upstream
    if (!chunk.__heartbeat) {
      const { message = "", ...labelSet } = chunk;
      client.stream(labelSet).log(message);
      this.count++;
      if (this.oldest === null) this.oldest = ts;
    }

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
