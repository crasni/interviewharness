// PROTOTYPE, throwaway (ADR 0022): does sherpa-onnx-node load and run inside an Electron utility process?
// Prints one JSON report and exits 0 on success, 1 on failure. Run: pnpm electron-check
const { app, utilityProcess } = require('electron');
const path = require('node:path');

app.whenReady().then(() => {
  const started = performance.now();
  const child = utilityProcess.fork(path.join(__dirname, 'worker.cjs'), [], { stdio: 'inherit', serviceName: 'voice-prototype' });
  let reported = false;
  child.on('message', (report) => {
    reported = true;
    console.log(JSON.stringify({ ...report, totalMs: Math.round(performance.now() - started) }, null, 2));
    app.exit(report.ok ? 0 : 1);
  });
  child.on('exit', (code) => {
    if (reported) return;
    console.error(`utility process exited with ${code} before reporting`);
    app.exit(1);
  });
  child.postMessage({ models: path.join(__dirname, '..', 'models-PROTOTYPE-wipe-me') });
});
