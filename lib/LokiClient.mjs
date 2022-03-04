import fetch from "@adobe/node-fetch-retry";

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Canonical stringification of labels
const labelKey = labels =>
  JSON.stringify(Object.entries(labels).sort((a, b) => cmp(a[0], b[0])));

const now = () => new Date().getTime();

export class LokiClient {
  constructor(endPoint, opt) {
    this.endPoint = endPoint;
    this.opt = Object.assign({ extraLabels: {} }, opt || {});

    // Streamers by label key
    this.streamers = {};

    // Message queues by label key
    this.queue = {};
  }

  static get timestamp() {
    return String(now()) + "000000";
  }

  get timestamp() {
    return this.constructor.timestamp;
  }

  labels(labelSet) {
    const { opt, streamers } = this;

    const makeStreamer = key => {
      const labels = Object.assign({}, opt.extraLabels, labelSet);

      const insert = values => {
        const { queue } = this;
        (queue[key] = queue[key] || []).push(...values);
        return streamer;
      };

      const log = (...lines) => {
        const { timestamp } = this;
        return insert(lines.flat().map(ln => [timestamp, ln]));
      };

      const streamer = { insert, log, labels };
      return streamer;
    };

    const key = labelKey(labelSet);
    return (streamers[key] = streamers[key] || makeStreamer(key));
  }

  get streams() {
    const { streamers, queue } = this;
    return Object.entries(queue).map(([key, values]) => ({
      stream: streamers[key].labels,
      values
    }));
  }

  async flush() {
    const { streams, endPoint } = this;

    if (!streams.length) return;

    // Clear queue
    this.queue = {};

    const res = await fetch(endPoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streams })
    });

    if (!res.ok)
      throw new Error(`Loki push failed: ${res.status} ${res.statusText}`);
  }
}
