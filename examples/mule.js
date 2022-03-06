import { LokiStream } from "grafana-loki-client";
import os from "os";
import util from "util";
import { once } from "events";
import * as stream from "stream";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const loki = new LokiStream("http://stilt:9088/loki/api/v1/push", {
  extraLabels: { host: os.hostname(), flag: "testing" }
});

const finished = util.promisify(stream.finished);

async function writeLoki(loki) {
  for (let i = 0; i < 30; i++) {
    const set = ["A", "B", "C"][i % 3];
    const chunk = { set, message: `ping ${i}` };
    if (!loki.write(chunk)) await once(loki, "drain");
    const waitFor = 500 + (i % 5) * 500;
    console.log(`ping ${i}, set ${set}, waiting ${waitFor}`);
    await delay(waitFor);
  }
  loki.end();
  await finished(loki);
}

await writeLoki(loki);
