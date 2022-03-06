import { MockLokiServer } from "../lib/test/MockLokiServer.mjs";

const ml = new MockLokiServer();
ml.pause();
ml.start().then(url => console.log({ url }));
setTimeout(() => ml.resume(), 10000);
