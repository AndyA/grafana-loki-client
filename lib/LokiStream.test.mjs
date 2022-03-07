import tap from "tap";
import { LokiStream } from "./LokiStream.mjs";
import { MockLokiServer } from "./test/MockLokiServer.mjs";

import util from "util";
import { once } from "events";
import * as stream from "stream";

const sum = itbl => itbl.reduce((a, b) => a + b, 0);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const finished = util.promisify(stream.finished);

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
  await testCode(loki, server);
  server.stop();
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

tap.test(`deadline (maxAge)`, () =>
  testLokiStream({ maxAge: 100 }, async (loki, server) => {
    await send(loki, {}, "Hello!");
    await delay(200);
    const want = [{ streams: [{ stream: {}, values: [[/^\d+$/, "Hello!"]] }] }];
    tap.match(server.consumeLog(), want, `timely`);
    await endLokiStream(loki);
  })
);

tap.test(`chunking (maxCount)`, () =>
  testLokiStream({ maxCount: 3, maxAge: 10000 }, async (loki, server) => {
    for (let i = 0; i < 30; i++) {
      await send(loki, { set: i % 2 }, `Message ${i}`);
    }
    await endLokiStream(loki);
    const log = server.consumeLog();
    // There should be 3 logs per payload
    tap.same(
      log.map(({ streams }) => sum(streams.map(s => s.values.length))),
      [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      `chunked`
    );
    // There should be 2 streams per payload
    tap.same(
      log.map(({ streams }) => streams.length),
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      `chunked`
    );
  })
);

tap.test(`watchdog pushback`, () =>
  testLokiStream({ maxAge: 100, maxCount: 3 }, async (loki, server) => {
    server.pause();
    await send(loki, {}, "Ping!");
    await delay(1000);
    tap.same(loki.ticker, null, `ticker has stopped`);
    server.resume();
    await delay(100);
    tap.notSame(loki.ticker, null, `ticker has started`);
    await endLokiStream(loki);
  })
);

tap.test(`simple 404`, () =>
  testLokiStream({ maxCount: 3 }, async (loki, server) => {
    const errors = [];
    const pusher = e => errors.push(e.message);
    loki.on("error", pusher);
    server.nextStatus(404);

    try {
      await send(loki, {}, "Ping!");
      await endLokiStream(loki);
    } catch (e) {
      console.error(e);
    }

    tap.match(errors, [/404/]);
    loki.off("error", pusher);
  })
);
