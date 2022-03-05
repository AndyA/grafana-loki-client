import tap from "tap";
import { LokiClient } from "./LokiClient.mjs";
import { MockLokiServer } from "./test/MockLokiServer.mjs";

tap.test(`streams`, async () => {
  const loki = new LokiClient("http://localhost:12345/loki/api/v1/push", {
    extraLabels: { flag: "testing", test: "streams" }
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
    stream: { flag: "testing", test: "streams", set },
    values: ["1", "2"].map(seq => [/^\d+$/, `${set}${seq}`])
  }));

  tap.match(streams, want, `stream looks good`);
});

tap.test(`flush`, async () => {
  const ml = new MockLokiServer();
  const url = await ml.start();

  const loki = new LokiClient(`${url}/loki/api/v1/push`, {
    extraLabels: { flag: "testing", test: "flush" }
  });

  loki.labels({ set: "A" }).log("Whoo!");
  loki.labels({ set: "B" }).log("Whoop!");
  await loki.flush();

  const want = [
    {
      streams: [
        {
          stream: { flag: "testing", test: "flush", set: "A" },
          values: [[/^\d+$/, "Whoo!"]]
        },
        {
          stream: { flag: "testing", test: "flush", set: "B" },
          values: [[/^\d+$/, "Whoop!"]]
        }
      ]
    }
  ];

  tap.match(ml.consumeLog(), want, `flush works`);

  // This flush should do nothing
  await loki.flush();
  tap.match(ml.consumeLog(), [], `no flush if empty`);

  ml.stop();
});

tap.only(`errors`, async () => {
  tap.test(`404`, async () => {
    const ml = new MockLokiServer();
    const url = await ml.start();
    console.log(url);

    ml.nextStatus(404);
    const loki = new LokiClient(`${url}/loki/api/v1/push`);

    loki.labels({ set: "A" }).log("Whoo!");

    // TODO why does this hang?
    // await tap.rejects(loki.flush(), /404/);

    const errs = [];

    // Do it the hard way
    try {
      await loki.flush();
    } catch (e) {
      errs.push(e.message);
    }

    tap.match(errs, [/404/]);

    ml.stop();
  });
});
