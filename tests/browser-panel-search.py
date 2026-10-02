"""Production custom-rule select search, driven by the existing mini1 extension driver."""
import os
from pathlib import Path

def run(context, worker):
    page = context.new_page()
    page.set_viewport_size({'width': 720, 'height': 820})
    page.set_content('<body style="background:white"></body>')
    page.evaluate("window.chrome={runtime:{id:'test',lastError:null,onMessage:{addListener(){}},sendMessage(m,cb){const r={ok:false};if(cb)setTimeout(()=>cb(r),0);return Promise.resolve(r)}}}")
    root = Path(os.environ['EXT_DIR'])
    page.add_script_tag(path=str(root/'rule-core.js'))
    page.add_script_tag(path=str(root/'content.js'))
    page.evaluate("""() => {
      window.searchPanel = RuleCore.sanitizePanel({id:'search',position:'center',title:'Search test',controls:[{id:'select',type:'select',options:Array.from({length:20},(_,i)=>({label:'Option '+i,value:'value-'+i})),value:'value-0'}]});
      searchPanel.groupId='test-group'; __cb_applyPanelSnapshots([searchPanel],['test-group']);
    }""")
    def evaluate(expression):
        return page.evaluate("() => {const root=document.querySelector('#__custom_blocker_panel_root__').shadowRoot;" + expression + "}")
    evaluate("root.querySelector('[data-cb-panel-select] button').click();")
    evaluate("const input=root.querySelector('[data-cb-panel-select] input');input.focus();input.value='OPTION 19';input.dispatchEvent(new InputEvent('input',{bubbles:true}));")
    assert evaluate("return root.querySelector('select').value==='value-0' && root.querySelector('[data-cb-panel-select] input').value==='OPTION 19';")
    assert evaluate("return [...root.querySelectorAll('[data-cb-panel-select] button')].filter(b=>b.textContent==='Option 19').length===1;")
    page.evaluate("searchPanel.controls[0].value='value-3';__cb_applyPanelSnapshots([searchPanel],['test-group'])")
    assert evaluate("return root.querySelector('[data-cb-panel-select] input').value==='OPTION 19' && root.activeElement===root.querySelector('[data-cb-panel-select] input');")
    evaluate("[...root.querySelectorAll('[data-cb-panel-select] button')].find(b=>b.textContent==='Option 19').click();")
    assert evaluate("return root.querySelector('select').value==='value-19';")
    print('PASS browser custom-rule select search preserves query/focus across patches and chooses the original option')
    page.evaluate("""() => {
      window.timerRows=Array.from({length:300},(_,i)=>({id:'timer-'+i,name:'Group '+i,displayMs:60000,overlayStyle:{fontWeight:'bold'}}));
      updateOverlay(timerRows,true);window.timerNode=document.getElementById('custom-web-blocker-timer').firstChild;
      updateOverlay(timerRows.map(row=>({...row,displayMs:59000})),true);
    }""")
    assert page.evaluate("() => document.getElementById('custom-web-blocker-timer').children.length===300 && timerNode===document.getElementById('custom-web-blocker-timer').firstChild && timerNode.textContent==='Group 0: 00:00:59'")
    page.evaluate("() => updateOverlay(timerRows.map(({overlayStyle,...row})=>row),true)")
    assert page.evaluate("() => document.getElementById('custom-web-blocker-timer').firstChild.nodeType===3 && document.getElementById('custom-web-blocker-timer').textContent.split('\\n').length===300 && document.getElementById('custom-web-blocker-timer').style.pointerEvents==='none'")
    page.evaluate("() => updateOverlay([],false)")
    assert page.evaluate("() => !document.getElementById('custom-web-blocker-timer')")
    print('PASS 300 styled timers reuse their rows, reset plain styling and retain click-through behavior')
    page.evaluate("""async () => {
      window.manyPanels=Array.from({length:256},(_,i)=>({...RuleCore.sanitizePanel({id:'panel-'+i,title:'Panel '+i,controls:[{id:'text',type:'text',text:'Text '+i}]}),groupId:'group-'+i}));
      let yielded=false;setTimeout(()=>{yielded=true},0);await __cb_applyPanelSnapshots(manyPanels,[]);window.panelScanYielded=yielded;
    }""")
    assert page.evaluate("() => panelScanYielded && document.querySelector('#__custom_blocker_panel_root__').shadowRoot.querySelectorAll('[data-cb-panel-id]').length===257")
    assert evaluate("return [...root.querySelectorAll('[data-cb-panel-stack]')].every(stack=>stack.style.overflowY==='auto')")
    print('PASS large browser panel stacks yield during construction and retain every panel in scrollable stacks')
    page.close()
