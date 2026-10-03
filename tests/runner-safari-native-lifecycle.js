"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname,"..","safari-native-lifecycle.js"), "utf8");
let messageListener, disconnectListener, reconnect;
let calls=0, pulses=0;
const bootstraps=[];
const context=vm.createContext({
  CBLocalHubEnvironment:{current:{nativeHost:"com.adamancia.vault.safari.development.extension"}},
  CB_SAFARI_RUNTIME_CONFIG:{environment:"development"},
  CBSafariLifetimeTick:async()=>{pulses++;},
  chrome:{runtime:{
    connectNative(host) {
      calls++;
      if(host!=="com.adamancia.vault.safari.development.extension") throw new Error("host mismatch");
      return {onMessage:{addListener(fn){messageListener=fn;}},onDisconnect:{addListener(fn){disconnectListener=fn;}}};
    },
    sendNativeMessage(host,message){bootstraps.push({host,message});return Promise.resolve({ok:true});}
  }},
  setTimeout(fn,delay){reconnect={fn,delay};return 1;}
});
context.self=context;
vm.runInContext(source,context);
function check(value,label){if(!value) throw new Error(label);console.log("PASS "+label);}
check(calls===1 && bootstraps[0]?.message.type==="safari-lifecycle-activate","native port starts independent containing helper");
messageListener({name:"safari-lifecycle-tick",userInfo:{type:"safari-lifecycle-tick"}});
check(pulses===1,"native envelope wakes lifetime tick with no content tab");
messageListener({type:"safari-lifecycle-tick"});
check(pulses===2,"direct native heartbeat wakes lifetime tick");
context.CBSafariLifetimeTick=()=>{pulses++;};
messageListener({type:"safari-lifecycle-tick"});
check(pulses===3,"shared void-returning background tick does not throw in native listener");
messageListener({name:"other",userInfo:{type:"unrelated"}});
check(pulses===3,"unrelated native messages do not run rules");
context.CBSafariNativeLifecycle.connect();
check(calls===1,"a live native port is reused");
disconnectListener();
check(reconnect?.delay===1000,"disconnected native port gets bounded reconnect");
reconnect.fn();
check(calls===2 && bootstraps.length===2,"native reconnect restores helper bootstrap");
console.log("__CB_TEST_RESULT__: OK (0 failures)");
