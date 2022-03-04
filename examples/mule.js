import { LokiClient } from "grafana-loki-client";
import os from "os";

const lc = new LokiClient("http://stilt:9088/loki/api/v1/push", {
  extraLabels: { host: os.hostname(), flag: "testing" }
});

lc.stream({ dir: "tx" }).log("A TX log").log("Another TX log");
lc.stream({ dir: "rx" }).log("An RX log").log("Another RX log");

// console.log(JSON.stringify(lc.streams, null, 2));
await lc.flush();
