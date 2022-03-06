import tap from "tap";
import { LokiStream } from "./LokiStream.mjs";
import { MockLokiServer } from "./test/MockLokiServer.mjs";

import util from "util";
import { once } from "events";
import * as stream from "stream";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const finished = util.promisify(stream.finished); // (A)

async function endLokiStream(loki) {
  loki.end();
  await finished(loki);
}

async function send(loki, labels, message) {
  const chunk = { ...labels, message };
  if (!loki.write(chunk)) await once(loki, "drain");
}

async function testLokiStream(opt, testCode) {
  const server = new MockLokiServer();
  const url = await server.start();
  const loki = new LokiStream(`${url}/loki/api/v1/push`, opt);
  const res = await testCode(loki, server);
  server.stop();
  return res;
}

tap.test(`basic`, () =>
  testLokiStream({ extraLabels: { mode: "testing" } }, async (loki, server) => {
    await send(loki, { set: "A" }, "Hello Loki!");
    await endLokiStream(loki);
    const want = [
      {
        streams: [
          {
            stream: { mode: "testing", set: "A" },
            values: [[/^\d+$/, "Hello Loki!"]]
          }
        ]
      }
    ];

    tap.match(server.consumeLog(), want, `simple`);
  })
);
