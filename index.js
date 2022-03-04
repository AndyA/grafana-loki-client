"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LokiClient = void 0;

var _nodeFetchRetry = _interopRequireDefault(
  require("@adobe/node-fetch-retry")
);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // Canonical stringification of labels

const labelKey = labels =>
  JSON.stringify(Object.entries(labels).sort((a, b) => cmp(a[0], b[0])));

class LokiClient {
  constructor(endPoint, opt) {
    this.endPoint = endPoint;
    this.opt = Object.assign(
      {
        extraLabels: {}
      },
      opt || {}
    );
    this.streamers = {};
    this.queue = {};
  }

  static get timestamp() {
    return String(new Date().getTime()) + "000000";
  }

  get timestamp() {
    return this.constructor.timestamp;
  }

  stream(labelSet) {
    const { opt, streamers, queue } = this;

    const makeStreamer = key => {
      const labels = Object.assign({}, opt.extraLabels, labelSet);

      const insert = values => {
        (queue[key] = queue[key] || []).push(...values);
        return streamer;
      };

      const log = (...lines) => {
        const { timestamp } = this;
        return insert(lines.flat().map(ln => [timestamp, ln]));
      };

      const streamer = {
        insert,
        log,
        labels
      };
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
    if (!streams.length) return; // Clear queue

    this.queue = {};
    const res = await (0, _nodeFetchRetry.default)(endPoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        streams
      })
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  }
}

exports.LokiClient = LokiClient;
