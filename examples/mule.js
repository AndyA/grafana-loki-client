import { LokiStream } from "grafana-loki-client";
import os from "os";
import util from "util";
import { once } from "events";
import * as stream from "stream";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const loki = new LokiStream("http://stilt:9088/loki/api/v1/push", {
  extraLabels: { host: os.hostname(), flag: "testing" }
});

// lc.stream({ dir: "tx" }).log("A TX log").log("Another TX log");
// lc.stream({ dir: "rx" }).log("An RX log").log("Another RX log");

// console.log(JSON.stringify(lc.streams, null, 2));
// await lc.flush();

const finished = util.promisify(stream.finished); // (A)

async function writeLoki(loki) {
  for (let i = 0; i < 3000; i++) {
    const waitFor = 1 + (i % 5);
    const set = ["A", "B", "C"][i % 3];
    const chunk = { set, message: `ping ${i}` };
    if (!loki.write(chunk)) await once(loki, "drain");
    // console.log(`ping ${i}, waiting ${waitFor}`);
    await delay(waitFor);
  }
  loki.end();
  await finished(loki);
}

await writeLoki(loki);
