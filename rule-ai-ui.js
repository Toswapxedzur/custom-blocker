/* Shared compact custom-rule settings. Models are credential-free host choices. */
(function(root) {
  "use strict";
  const section=document.getElementById("ruleAISettings");
  if (!section) return;
  const model=document.getElementById("ruleAIModel"), effort=document.getElementById("ruleAIEffort"), cap=document.getElementById("ruleAICap"), refresh=document.getElementById("ruleAIRefresh"), status=document.getElementById("ruleAIStatus");
  let choices=[], current=null, busy=false, loaded=false;
  const key=value=>JSON.stringify([value?.providerModel ?? value?.value ?? "",value?.accountID ?? ""]);
  const tr=(name,fallback)=> typeof root.CBRuleAIText === "function" ? root.CBRuleAIText(name,fallback) : fallback;
  function read() {
    if (!model.value) return null;
    const [providerModel,accountID]=JSON.parse(model.value);
    return {providerModel,accountID,reasoningEffort:effort.value||"default",dailyRequestLimit:cap.value.trim()===""?null:Number(cap.value)};
  }
  function draw() {
    if (!current) return;
    const value=current.value;
    model.replaceChildren(new Option(tr("custom.ai.none","Not configured"),""));
    for (const item of choices) model.add(new Option(item.label,key(item)));
    if (value && !choices.some(item=>key(item)===key(value))) model.add(new Option(tr("custom.ai.unavailable","Unavailable")+" · "+value.providerModel,key(value)));
    model.value=value?key(value):"";
    const selected=choices.find(item=>key(item)===model.value);
    const efforts=selected?.efforts ?? ["default",...(value && value.reasoningEffort!=="default"?[value.reasoningEffort]:[])];
    effort.replaceChildren();
    for (const name of efforts) effort.add(new Option(tr("custom.ai.effort."+name,({default:"Model default",low:"Low",medium:"Medium",high:"High"})[name]||name),name));
    effort.value=value?.reasoningEffort ?? "default";
    cap.value=value?.dailyRequestLimit == null?"":String(value.dailyRequestLimit);
    model.disabled=!current.editable; effort.disabled=!current.editable||!value;cap.disabled=!current.editable||!value;refresh.disabled=busy;
  }
  async function load() {
    if (busy) return;
    busy=true;refresh.disabled=true;status.textContent=tr("custom.ai.loading","Loading models…");
    try {
      const result=await chrome.runtime.sendMessage({type:"rule-ai-models"});
      choices=result?.ok && Array.isArray(result.models)?result.models.filter(item=>typeof item.value==="string"&&typeof item.label==="string"&&Array.isArray(item.efforts)):[];
      loaded=true;
      status.textContent=result?.ok ? (choices.length?tr("custom.ai.search","Search is enabled. Linked groups share the allowance."):tr("custom.ai.connect","Connect an AI provider and fetch its models in Mac Vault Settings.")) : tr("custom.ai.disconnected","Connect to Mac Vault to use AI.");
    } catch (_) {status.textContent=tr("custom.ai.disconnected","Connect to Mac Vault to use AI.");}
    finally {busy=false;draw();}
  }
  function changed(event) {
    if (!current?.editable) return;
    if (event.target===model) {
      const selected=choices.find(item=>key(item)===model.value);
      if (selected && !selected.efforts.includes(effort.value)) effort.value="default";
    }
    current.value=read();
    if (event.target===model) draw();
    current.change();
  }
  for (const element of [model,effort,cap]) element.addEventListener("change",changed);
  refresh.addEventListener("click",()=>void load());
  root.CBRuleAIUI={read,render(group,editable,value,change) {
    current={id:group.id,editable,value,change};draw();if(!loaded&&!busy)void load();
  }};
})(window);
