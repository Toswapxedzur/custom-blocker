/* Shared compact custom-rule settings. Models are credential-free host choices. */
(function(root) {
  "use strict";
  const section=document.getElementById("ruleAISettings");
  if (!section) return;
  const model=document.getElementById("ruleAIModel"), modelID=document.getElementById("ruleAIModelID"), cap=document.getElementById("ruleAICap"), prompt=document.getElementById("ruleAIPrompt"), context=document.getElementById("ruleAIContext"), refresh=document.getElementById("ruleAIRefresh"), status=document.getElementById("ruleAIStatus");
  let choices=[], current=null, busy=false, loaded=false;
  const tr=(name,fallback)=> typeof root.CBRuleAIText === "function" ? root.CBRuleAIText(name,fallback) : fallback;
  function read() {
    return {dailyRequestLimit:cap.value.trim()===""?null:Number(cap.value),prompt:prompt.value,context:context.value};
  }
  function draw() {
    if (!current) return;
    const value=current.value;
    const selected=model.value;
    model.replaceChildren(new Option(tr("custom.ai.none","Choose a model to copy its ID"),""));
    for (const item of choices) model.add(new Option(item.label,item.value));
    model.value=choices.some(item=>item.value===selected)?selected:"";
    modelID.value=model.value;
    cap.value=value?.dailyRequestLimit == null?"":String(value.dailyRequestLimit);
    prompt.value=value?.prompt ?? ""; context.value=value?.context ?? "";
    model.disabled=busy;cap.disabled=!current.editable;prompt.disabled=!current.editable;context.disabled=!current.editable;refresh.disabled=busy;
  }
  async function load() {
    if (busy) return;
    busy=true;refresh.disabled=true;status.textContent=tr("custom.ai.loading","Loading models…");
    try {
      const result=await chrome.runtime.sendMessage({type:"rule-ai-models"});
      choices=result?.ok && Array.isArray(result.models)?result.models.filter(item=>typeof item.value==="string"&&typeof item.label==="string"&&Array.isArray(item.efforts)):[];
      loaded=true;
      status.textContent=result?.ok ? (choices.length?tr("custom.ai.search","Copy a model ID into each v.ai call. Named conversations are saved by desktop Vault; linked groups share them."):tr("custom.ai.connect","Connect an AI provider and fetch its models in Vault Settings.")) : tr("custom.ai.disconnected","Connect to desktop Vault to use AI.");
    } catch (_) {status.textContent=tr("custom.ai.disconnected","Connect to desktop Vault to use AI.");}
    finally {busy=false;draw();}
  }
  function changed(event) {
    if (!current?.editable) return;
    if (event.target===model) {modelID.value=model.value;return;}
    current.value=read();
    current.change();
  }
  for (const element of [model,cap,prompt,context]) element.addEventListener("change",changed);
  refresh.addEventListener("click",()=>void load());
  root.CBRuleAIUI={read,render(group,editable,value,change) {
    current={id:group.id,editable,value,change};draw();if(!loaded&&!busy)void load();
  }};
})(window);
