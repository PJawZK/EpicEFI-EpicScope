export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Browser-side checks run through Vite; this transport owns no application hooks.
export async function connect(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error(`DevTools discovery failed: ${response.status}`);
  const version = await response.json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(Error('DevTools connection timeout')); }, 10000);
    ws.onopen = () => { clearTimeout(timer); resolve(); };
    ws.onerror = () => { clearTimeout(timer); reject(Error('DevTools connection failed')); };
  });
  let nextId = 0;
  let session;
  let disposed = false;
  const pending = new Map();
  const listeners = new Map();
  const rejectPending = error => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
  };
  ws.onclose = () => rejectPending(Error('DevTools connection closed'));
  ws.onerror = () => rejectPending(Error('DevTools transport error'));
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method && message.sessionId === session) listeners.get(message.method)?.(message.params);
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  };
  const send = (method, params = {}, sessionId, timeout = 20000) => new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) { reject(Error('DevTools connection is not open')); return; }
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`DevTools timeout: ${method}`)); }, timeout);
    pending.set(id, { resolve, reject, timer });
    try { ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
  let browserContextId;
  try {
    ({ browserContextId } = await send('Target.createBrowserContext'));
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    ({ sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true }));
  } catch (error) {
    if (browserContextId) await send('Target.disposeBrowserContext', { browserContextId }, undefined, 5000).catch(() => {});
    ws.close();
    throw error;
  }
  const call = (method, params = {}, timeout) => disposed
    ? Promise.reject(Error('Browser context is disposed'))
    : send(method, params, session, timeout);
  const evaluate = async (expression, timeout) => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeout);
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const file = async (selector, filePath) => {
    const doc = await call('DOM.getDocument');
    const { nodeId } = await call('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    if (!nodeId) throw Error(`Missing file input: ${selector}`);
    await call('DOM.setFileInputFiles', { nodeId, files: [filePath] });
  };
  const close = async () => {
    disposed = true;
    try { await send('Target.disposeBrowserContext', { browserContextId }, undefined, 5000); }
    finally { ws.close(); }
  };
  return { call, evaluate, file, close, on: (method, listener) => listeners.set(method, listener) };
}
