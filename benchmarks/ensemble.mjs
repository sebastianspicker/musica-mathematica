import { performance } from "node:perf_hooks";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
});
try {
  const { defaultConfig } = await server.ssrLoadModule("/src/domains/ensemble-dynamics/config.ts");
  const { simulateEnsemble } = await server.ssrLoadModule("/src/domains/ensemble-dynamics/model.ts");
  const config = {
    ...defaultConfig, musicianCount: 16, tempoBpm: 180, tempoSpreadBpm: 24,
    couplingStrength: 3, latencySeconds: 0.18, jitterSeconds: 0.06,
    topology: "all-to-all", repertoireTexture: "dense-rhythm", clickTrackStrength: 3,
  };
  for (let i = 0; i < 5; i++) simulateEnsemble(config, 8);
  const samples = [];
  for (let i = 0; i < 21; i++) {
    const start = performance.now();
    simulateEnsemble(config, 8);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({ runtime: process.version, durationSeconds: 8, config, warmups: 5, samples: 21, medianMs: samples[10], p95Ms: samples[19] }, null, 2));
} finally {
  await server.close();
}
