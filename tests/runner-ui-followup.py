"""UI regression checks through the existing extension driver on mini1.
Requires the current Mac source beside this repo; all Classifier/Activity/tag state is synthetic.
"""
import functools, http.server, json, os, threading
from pathlib import Path
CAP=Path(os.environ['UI_CAPTURE_DIR'])
EXT=Path(os.environ['EXT_DIR'])
MAC=EXT.parent/'macosBlocker'
results={}

def run(context,worker):
    page=context.new_page();page.set_viewport_size({'width':720,'height':820})
    page.goto(f"chrome-extension://{worker.url.split('/')[2]}/popup.html")
    page.wait_for_selector('#settingsButton')
    page.locator('#settingsButton').click()
    results['settings_initial']=page.evaluate("({active:document.activeElement.id, role:document.querySelector('#settingsModal .modal-card').getAttribute('role'),focusInside:document.querySelector('#settingsModal').contains(document.activeElement)})")
    page.locator('#settingsCloseButton').focus();page.keyboard.press('Escape')
    results['settings_close']=page.evaluate("({closed:document.querySelector('#settingsModal').classList.contains('hidden'),active:document.activeElement.id})")
    page.locator('#manualButton').click();page.wait_for_timeout(150)
    results['manual_initial']=page.evaluate("({active:document.activeElement.id,role:document.querySelector('#manualModal .modal-card').getAttribute('role'),focusInside:document.querySelector('#manualModal').contains(document.activeElement)})")
    page.keyboard.press('Escape')
    # A Mac-only function: emulate its availability without changing stored groups.
    page.evaluate('blockedAppsEditable=true;openAppPicker()');page.wait_for_timeout(100)
    page.keyboard.press('Escape')
    results['app_picker_escape']=page.evaluate("({closed:document.querySelector('#appPickerModal').classList.contains('hidden'),active:document.activeElement.id,role:document.querySelector('#appPickerModal .modal-card').getAttribute('role')})")
    page.evaluate('closeAppPicker()');page.close()

    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(MAC))
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}/classifier/Tests/WebUI/'
    page=context.new_page();page.set_viewport_size({'width':720,'height':820})
    page.goto(base+'autosave.html');page.wait_for_function("scope.querySelector('[data-action=selectType]')")
    page.evaluate("scope.querySelector('[data-action=openUtilityPanel]').click()")
    page.wait_for_function("scope.querySelector('[data-action=confirmDeleteProviderProfile]')")
    results['group_labels']=page.evaluate("({sidebar:scope.querySelector('[data-action=newType]').textContent.trim()})")
    page.evaluate("commands.length=0;scope.querySelector('[data-action=confirmDeleteProviderProfile]').click()")
    results['provider_first_click']=page.evaluate("({actions:commands.map(x=>x.action),label:scope.querySelector('[data-action=confirmDeleteProviderProfile]').textContent})")
    page.evaluate("scope.querySelector('[data-action=confirmDeleteProviderProfile]').click()")
    results['provider_second_click']=page.evaluate("commands.map(x=>x.action)")
    page.goto(base+'activity.html');page.wait_for_function("scope.querySelector('.group-card button')")
    page.evaluate("scope.querySelector('.group-card button').click()")
    results['activity_focus']=page.evaluate("""() => {const input=scope.querySelector('.group-top input');input.focus();input.value='A draft name';input.dispatchEvent(new Event('input',{bubbles:true}));input.setSelectionRange(2,7);activityApply(structuredClone(testSnapshot),{},{},{keepDays:365,platforms:[]},[]);const after=scope.querySelector('.group-top input');return {value:after.value,focusPreserved:scope.activeElement===after,selection:[after.selectionStart,after.selectionEnd]}}""")
    results['activity_known_items_focus']=page.evaluate("""() => {const input=scope.querySelector('input[type=search]');input.focus();input.value='Another';input.dispatchEvent(new Event('input',{bubbles:true}));activityKnownItems([{id:'app|com.example.Other',label:'Another app',kind:'App'}],{});return {value:scope.querySelector('input[type=search]').value,focusPreserved:scope.activeElement===scope.querySelector('input[type=search]')}}""")
    page.screenshot(path=str(CAP/'activity-720.png'));page.close();server.shutdown()

    # Synthetic source transport, actual production closed-shadow renderer.
    page=context.new_page();page.set_viewport_size({'width':720,'height':820})
    page.emulate_media(color_scheme='dark')
    page.set_content('<style>body{background:#111;color:#fff;font:14px Arial}article{position:absolute;left:595px;bottom:45px;width:120px}a{display:block;color:#fff}</style><article><a href="#">Sample video</a></article>')
    page.evaluate("""() => {
      window.testShadows=[];const original=Element.prototype.attachShadow;
      Element.prototype.attachShadow=function(o){const r=original.call(this,o);testShadows.push(r);return r};
      window.messages=[];window.listeners=[];window.rejectCorrection=false;
      window.tags=[{id:'science',name:'Science',lightColorHex:'#9EC5E8',darkColorHex:'#1A4775'}];
      window.chrome={runtime:{id:'test',lastError:null,onMessage:{addListener:f=>listeners.push(f)},sendMessage(m,cb){messages.push(m);
        let r={ok:true,platformID:'youtube',entryID:m.entryID,tags:window.pendingTags?[]:tags,predicted:true,pending:window.pendingTags===true};
        if(m.type==='vault-classifier-video-tags-batch')r.items=m.items.map(i=>({...r,entryID:i.entryID}));
        if(m.type==='vault-classifier-classifier-taxonomy')r={ok:true,types:[{typeID:'group',tags:[...tags,{id:'music',name:'Music',lightColorHex:'#E3B4E7',darkColorHex:'#6B246F'}]}]};
        if(m.type==='vault-classifier-submit-correction')r={ok:!rejectCorrection};
        if(cb)setTimeout(()=>cb(r),0);return Promise.resolve(r);
      }}};
    }""")
    page.add_script_tag(path=str(EXT/'vault-classifier-contract.js'));page.add_script_tag(path=str(EXT/'vault-classifier-tag-ui.js'))
    page.evaluate("VaultClassifierTagUI.observe({platform:'youtube',entryID:'youtube:video:test',creatorID:'youtube:channel:test',title:'Sample',root:document.querySelector('article'),anchor:document.querySelector('a')})")
    page.wait_for_function("testShadows[0]?.querySelector('.chip-del')")
    results['prediction_style']=page.evaluate("""() => {const c=getComputedStyle(testShadows[0].querySelector('.chip'));return {background:c.backgroundColor,color:c.color,host:getComputedStyle(document.body).backgroundColor}}""")
    page.evaluate("testShadows[0].querySelector('.add-btn').click()");page.wait_for_function("testShadows[0].querySelector('.panel-item')")
    results['tag_picker_bounds']=page.evaluate("""() => {const p=testShadows[0].querySelector('.panel').getBoundingClientRect();return {right:p.right,bottom:p.bottom,width:innerWidth,height:innerHeight}}""")
    page.keyboard.press('Escape');results['tag_picker_escape']=page.evaluate("testShadows[0].querySelector('.panel').classList.contains('open')")
    page.evaluate("testShadows[0].querySelector('.add-btn').click()")
    page.wait_for_function("testShadows[0].querySelector('.panel-item')")
    page.screenshot(path=str(CAP/'tag-picker-edge.png'))
    page.mouse.click(20,20)
    results['tag_picker_outside']=page.evaluate("testShadows[0].querySelector('.panel').classList.contains('open')")
    page.evaluate("document.body.style.background='#fff';document.querySelector('a').style.color='#1f2937'")
    page.emulate_media(color_scheme='light')
    results['prediction_light_page']=page.evaluate("getComputedStyle(testShadows[0].querySelector('.chip')).backgroundColor")
    page.screenshot(path=str(CAP/'tag-colored-light.png'))
    page.evaluate("testShadows[0].querySelector('.panel-close').click();testShadows[0].querySelector('.chip-wrap').focus()")
    page.evaluate("listeners.forEach(f=>f({type:'vault-classifier-video-tags-updated',platform:'youtube',items:[{entryID:'youtube:video:test',tags:[{...tags[0],name:'Renamed Science'}],predicted:true}]},{id:'test'}))")
    page.wait_for_function("testShadows[0].activeElement?.classList.contains('chip-wrap')")
    results['tag_focus_after_push']=page.evaluate("({armed:testShadows[0].querySelector('.chip-del').classList.contains('armed'),label:testShadows[0].querySelector('.chip-del').textContent,focusPreserved:testShadows[0].activeElement?.classList.contains('chip-wrap')})")
    page.evaluate("rejectCorrection=true;testShadows[0].querySelector('.chip-del').click()")
    page.wait_for_function("messages.some(m=>m.type==='vault-classifier-submit-correction')")
    page.wait_for_timeout(100)
    results['failed_correction']=page.evaluate("({text:testShadows[0].textContent,tag:testShadows[0].querySelector('.chip').textContent})")
    page.evaluate("rejectCorrection=false;testShadows[0].querySelector('.retry').click()")
    page.wait_for_function("messages.filter(m=>m.type==='vault-classifier-submit-correction').length===2 && testShadows[0].querySelector('.correction-status').textContent===''")
    results['correction_retry']=page.evaluate("({tag:testShadows[0].querySelector('.chip').textContent,status:testShadows[0].querySelector('.correction-status').textContent})")
    page.evaluate("pendingTags=true;VaultClassifierTagUI.clearPlatform('youtube');VaultClassifierTagUI.observe({platform:'youtube',entryID:'youtube:video:pending',creatorID:'youtube:channel:test',title:'Pending',root:document.querySelector('article'),anchor:document.querySelector('a')})")
    page.wait_for_function("testShadows[1]?.querySelector('.chip.tagging')")
    results['tagging_color']=page.evaluate("getComputedStyle(testShadows[1].querySelector('.chip.tagging')).backgroundColor")
    page.screenshot(path=str(CAP/'tagging-colored-light.png'))
    page.emulate_media(color_scheme='dark')
    results['tagging_dark_browser']=page.evaluate("() => {const c=getComputedStyle(testShadows[1].querySelector('.chip.tagging'));return {fill:c.backgroundColor,border:c.borderTopStyle}}")
    page.close()

    page=context.new_page();page.set_viewport_size({'width':720,'height':820});page.set_content('<body style="background:white"></body>')
    page.evaluate("window.chrome={runtime:{id:'test',lastError:null,onMessage:{addListener(){}},sendMessage(m,cb){const r={ok:false};if(cb)setTimeout(()=>cb(r),0);return Promise.resolve(r)}}}")
    page.add_script_tag(path=str(EXT/'rule-core.js'));page.add_script_tag(path=str(EXT/'content.js'))
    page.evaluate("""() => {const p=RuleCore.sanitizePanel({id:'audit',position:'center',title:'Rule panel',controls:[{id:'html',type:'html',html:'<style>[data-cb-panel-id]{background:#111 !important;color:white !important;font-family:serif !important}</style><div style="color:#ff0000">Supplied red</div>'},{id:'input',type:'textInput',value:'Field'},{id:'select',type:'select',options:['One','Two'],value:'One'},{id:'pin',type:'pin',value:'123'},{id:'check',type:'checkbox',label:'Check',value:true},{id:'radio',type:'radio',options:['One','Two'],value:'One'}]});p.groupId='g';__cb_applyPanelSnapshots([p],['g'])}""")
    results['rule_html_styles']=page.evaluate("""() => {const root=document.querySelector('#__custom_blocker_panel_root__').shadowRoot;const card=root.querySelector('[data-cb-panel-id]');const c=getComputedStyle(card);return {background:c.backgroundColor,color:c.color,font:c.fontFamily,select:root.querySelector('select')?.tagName}}""")
    results['rule_controls']=page.evaluate("""() => {const r=document.querySelector('#__custom_blocker_panel_root__').shadowRoot;return {nativeSelectHidden:getComputedStyle(r.querySelector('select')).display==='none',checkboxAppearance:getComputedStyle(r.querySelector('input[type=checkbox]')).appearance,pinFont:getComputedStyle(r.querySelector('[data-cb-panel-control-root-type=pin] div div')).fontFamily}}""")
    page.evaluate("document.querySelector('#__custom_blocker_panel_root__').shadowRoot.querySelector('[data-cb-panel-select] button').click()")
    page.evaluate("document.querySelector('#__custom_blocker_panel_root__').shadowRoot.querySelectorAll('[data-cb-panel-select] button')[2].click()")
    results['rule_select_choice']=page.evaluate("document.querySelector('#__custom_blocker_panel_root__').shadowRoot.querySelector('select').value")
    page.screenshot(path=str(CAP/'rule-html-styling.png'));page.close()
    expect=lambda condition,label: check(condition,label)
    expect(results['settings_initial']['focusInside'] and results['settings_initial']['role']=='dialog','Settings receives dialog focus')
    expect(results['settings_close']['active']=='settingsButton','Settings returns focus')
    expect(results['manual_initial']['focusInside'] and results['manual_initial']['role']=='dialog','Manual receives dialog focus')
    expect(results['app_picker_escape']['closed'] and results['app_picker_escape']['role']=='dialog','App picker closes on Escape')
    expect(not results['provider_first_click']['actions'] and results['provider_second_click']==['confirmDeleteProviderProfile'],'Provider requires two clicks')
    expect(results['activity_focus']['focusPreserved'] and results['activity_focus']['selection']==[2,7],'Activity keeps name focus and caret')
    expect(results['activity_known_items_focus']['focusPreserved'],'Activity keeps search focus on known-items response')
    expect(results['prediction_style']['background']=='rgb(158, 197, 232)' and results['prediction_light_page']=='rgb(26, 71, 117)','Predicted pills keep color and invert browser preference')
    bounds=results['tag_picker_bounds']
    expect(bounds['right']<=bounds['width'] and bounds['bottom']<=bounds['height'],'Tag picker stays within viewport')
    expect(not results['tag_picker_escape'] and not results['tag_picker_outside'],'Tag picker closes on Escape and outside click')
    expect(not results['tag_focus_after_push']['armed'] and results['tag_focus_after_push']['focusPreserved'],'Tag keyboard focus survives classification update without confirmation')
    expect(results['tagging_color']=='rgb(30, 58, 138)','Tagging uses a colored dark fill for a light browser')
    expect(results['tagging_dark_browser']=={'fill':'rgb(219, 234, 254)','border':'dashed'},'Mounted Tagging pill flips to a light fill for a dark browser and keeps its dashed indicator')
    expect('Could not save tag correction' in results['failed_correction']['text'],'Correction failure is visible')
    expect(results['correction_retry']=={'tag':'None','status':''},'Retry saves the failed correction')
    expect(results['rule_html_styles']['background']=='rgba(15, 23, 42, 0.96)' and 'Arial' in results['rule_html_styles']['font'],'Rule HTML cannot override fixed panel theme')
    expect(results['rule_controls']['nativeSelectHidden'] and results['rule_controls']['checkboxAppearance']=='none' and 'Arial' in results['rule_controls']['pinFont'],'Rule controls use drawn controls and Arial PIN')
    expect(results['rule_select_choice']=='Two','Drawn rule select preserves choice behavior')
    CAP.joinpath('findings.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2),flush=True)


def check(condition,label):
    assert condition,label
    print("PASS "+label,flush=True)
