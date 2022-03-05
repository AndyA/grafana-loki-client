import tap from "tap";
import { LokiClient } from "./LokiClient.mjs";

tap.test(`basic`, async () => {
  const loki = new LokiClient("http://localhost:12345/loki/api/v1/push", {
    extraLabels: { flag: "testing", test: "basic" }
  });

  const la = loki.labels({ set: "A" });
  const lb = loki.labels({ set: "B" });
  const lc = loki.labels({ set: "C" });

  la.log("A1");
  lb.log("B1").log("B2");
  lc.log("C1");
  la.log("A2");
  lc.log("C2");

  const streams = loki.streams;

  const want = ["A", "B", "C"].map(set => ({
    stream: { flag: "testing", test: "basic", set },
    values: ["1", "2"].map(seq => [/^\d+$/, `${set}${seq}`])
  }));

  tap.match(streams, want, `stream looks good`);
});
