/* Authenticated host RPC only. No credential or provider-specific rule API. */
(function(root) {
  "use strict";
  function createClient(connection, timeoutMs = 75000) {
    const pending = new Map();
    function finish(id, body) {
      const item = pending.get(id); if (!item) return;
      pending.delete(id); clearTimeout(item.timer); item.resolve(body);
    }
    const unavailable = () => ({ok:false,error:"ai-unavailable",text:null,citations:[]});
    return {
      request(operation, groupId = "", payload = "") {
        const c = connection();
        if (!c?.desktopRouteIsReady() || c.ruleAIVersion !== 1 || pending.size >= 16) return Promise.resolve(unavailable());
        const requestID = root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
        return new Promise(resolve => {
          const item = {resolve, ws:c.ws, timer:setTimeout(() => finish(requestID,unavailable()),operation === "models" ? 5000 : timeoutMs)};
          pending.set(requestID,item);
          if (!c.sendWS({kind:"rule-ai-request",requestID,operation,groupId,payload})) finish(requestID,unavailable());
        });
      },
      receive(message) {
        const item=pending.get(message?.requestID), c=connection();
        if (!item || item.ws !== c?.ws || !c?.desktopRouteIsReady()) return;
        const body=message.body;
        if (!body || typeof body !== "object" || JSON.stringify(body).length > 800000) return finish(message.requestID,unavailable());
        finish(message.requestID,body);
      },
      disconnected() { for (const id of pending.keys()) finish(id,unavailable()); },
      get size() {return pending.size;}
    };
  }
  root.CBRuleAITransport = Object.freeze({createClient});
  root.CBRuleAIHub = createClient(() => typeof cbConnection !== "undefined" ? cbConnection : null);
})(typeof self !== "undefined" ? self : globalThis);
