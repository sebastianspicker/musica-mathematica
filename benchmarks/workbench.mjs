import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const root = process.cwd();
const label = (process.argv[2] ?? 'current').replace(/[^a-zA-Z0-9_-]/g, '_');
const resultVisualInstanceId = 'const instanceId = useId();';
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5193, strictPort: true, watch: null }, plugins: [{ name: 'temporary-render-profile', enforce: 'pre', transform(code, id) {
 if (id.endsWith('/src/main.tsx')) return 'import "/benchmarks/workbenchProfileMain.tsx";';
 if (id.endsWith('/src/ui/workbench/ResultVisual.tsx')) {
  if (!code.includes(resultVisualInstanceId)) throw new Error(`ResultVisual.tsx no longer contains "${resultVisualInstanceId}"; update the geometry counter.`);
  return code.replace(resultVisualInstanceId, `if (window.__profile) window.__profile.geometry += 1;\n  ${resultVisualInstanceId}`);
 }
} }] });
await server.listen();
const browser = await chromium.launch();
try {
 const page = await browser.newPage({ viewport: {width:1440,height:1000}, reducedMotion:'no-preference' });
 await page.goto('http://127.0.0.1:5193/#/labs/phase-proportion/lessons/from-bpm-to-period');
 await page.getByLabel('Motion', {exact:true}).check();
 // Playback controls live in the collapsed model-exploration section of the notebook.
 await page.getByText('Explore the model, charts and playback', {exact:true}).click();
 const runs=[];
 for(let i=0;i<5;i++) {
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(2000);
  await page.evaluate(()=>window.__profile={durations:[],geometry:0});
  await page.waitForTimeout(5000);
  runs.push(await page.evaluate(()=>{ const p=window.__profile; window.__profile=null; return p; }));
 }
 const durations=runs.flatMap(r=>r.durations).sort((a,b)=>a-b);
 const result={label,browser:browser.version(),viewport:'1440x1000',mode:'Vite development React StrictMode Profiler',workload:'From BPM to Period synthetic playback, deterministic demo factors and two saved trials, controlled local fixture, 5 repeats of 2s warmup + 5s sampled playback',unit:'milliseconds actualDuration per React commit',median:durations[Math.floor(durations.length*.5)],p95:durations[Math.ceil(durations.length*.95)-1],commits:runs.map(r=>r.durations.length),geometry:runs.map(r=>r.geometry),runs};
 await writeFile(`/tmp/mm-workbench-${label}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,runs:undefined}));
} finally { await browser.close(); await server.close(); }
