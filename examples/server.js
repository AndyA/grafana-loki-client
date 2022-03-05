import { MockLokiServer } from "../lib/test/MockLokiServer.mjs";

const ml = new MockLokiServer();
ml.start().then(url => console.log({ url }));
setTimeout(() => ml.stop(), 10000);
