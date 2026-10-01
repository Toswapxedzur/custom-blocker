"""Real Chromium UI checks, run through the existing extension driver --ui-script.
Tag transport is synthetic; the popup uses the loaded extension's chrome APIs.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def run(context, worker):
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f"chrome-extension://{worker.url.split('/')[2]}/popup.html")
    page.wait_for_selector('#addGroupButton')
    page.locator('#addGroupButton').focus()
    page.evaluate("() => {window.dialogResult='pending'; cbDialog.prompt('Name a test group', '', {title:'Test creation'}).then(r=>window.dialogResult=r)}")
    card=page.locator('.vui-dialog')
    assert card.get_attribute('aria-label') == 'Test creation'
    assert page.locator('.vui-dialog input').evaluate('(e)=>e===document.activeElement')
    page.keyboard.press('Shift+Tab')
    assert card.locator('button').last.evaluate('(e)=>e===document.activeElement')
    page.keyboard.press('Tab')
    assert card.locator('input').evaluate('(e)=>e===document.activeElement')
    page.keyboard.press('Escape')
    assert page.evaluate('window.dialogResult') is None
    assert page.locator('#addGroupButton').evaluate('(e)=>e===document.activeElement')
    print('PASS extension prompt initial focus, Tab wrapping, Escape and return focus')
    page.evaluate("() => {cbDialog.confirm('Confirm test').then(r=>window.dialogResult=r)}")
    page.locator('.vui-dialog button').first.focus()
    page.keyboard.press('Enter')
    assert page.evaluate('window.dialogResult') is False
    print('PASS Enter on Cancel cancels rather than confirming')
    assert not errors, errors
    page.close()

    page=context.new_page()
    page.emulate_media(color_scheme='dark')
    page.set_content('<style>body{font:14px Arial;background:#fff;padding:30px}article{padding:20px}</style><article><a href="#">Synthetic video</a></article>')
    page.evaluate("""() => {
        window.testShadows=[];const original=Element.prototype.attachShadow;
        Element.prototype.attachShadow=function(options){const root=original.call(this,options);testShadows.push(root);return root};
        window.messages=[];
        const tags=[{id:'science',name:'Science',lightColorHex:'#9EC5E8',darkColorHex:'#1A4775'}, {id:'music',name:'Music',lightColorHex:'#E3B4E7',darkColorHex:'#6B246F'}];
        window.chrome={runtime:{id:'test',lastError:null,onMessage:{addListener(){}},sendMessage(message,callback){
          messages.push(message);
          let response={ok:true,platformID:'youtube',entryID:message.entryID,tags:[tags[0]],predicted:false,pending:false};
          if(message.type==='vault-classifier-video-tags-batch')response.items=message.items.map(i=>({...response,entryID:i.entryID}));
          if(message.type==='vault-classifier-classifier-taxonomy')response={ok:true,types:[{typeID:'group',tags}]};
          setTimeout(()=>callback(response),0);
        }}};
    }""")
    page.add_script_tag(path=str(ROOT/'vault-classifier-contract.js'))
    page.add_script_tag(path=str(ROOT/'vault-classifier-tag-ui.js'))
    page.evaluate("VaultClassifierTagUI.observe({platform:'youtube',entryID:'youtube:video:test',creatorID:'youtube:channel:test',title:'Synthetic video',root:document.querySelector('article'),anchor:document.querySelector('a')})")
    page.wait_for_function("testShadows[0]?.querySelector('.chip-del')")
    def evaljs(source): return page.evaluate(source)
    evaljs("testShadows[0].querySelector('.chip-wrap').focus()")
    page.keyboard.press('Delete')
    assert evaljs("messages.filter(m=>m.type==='vault-classifier-submit-correction').length") == 0
    assert evaljs("testShadows[0].querySelector('.chip-del').classList.contains('armed')")
    page.keyboard.press('Delete')
    page.wait_for_function("messages.some(m=>m.type==='vault-classifier-submit-correction')")
    assert evaljs("messages.find(m=>m.type==='vault-classifier-submit-correction').correctTagIDs.length") == 0
    print('PASS Delete requires two presses and submits the correct tag set')
    evaljs("testShadows[0].querySelector('.add-btn').click()")
    page.wait_for_function("testShadows[0].querySelector('.panel-item')")
    styles=evaljs("""() => {const root=testShadows[0], p=getComputedStyle(root.querySelector('.panel')),f=getComputedStyle(root.querySelector('.panel-search'));return [p.backgroundColor,p.fontFamily,f.borderTopWidth,f.backgroundColor]}""")
    assert styles[0]=='rgb(255, 255, 255)' and 'Arial' in styles[1] and styles[2]=='0px' and styles[3]=='rgb(241, 245, 249)',styles
    print('PASS tag picker stays light under a dark host preference and uses Arial filled fields')
    evaljs("testShadows[0].querySelector('.panel-item').click()")
    page.wait_for_function("testShadows[0].querySelector('.chip-del')")
    evaljs("testShadows[0].querySelector('.chip-del').click()")
    assert evaljs("messages.filter(m=>m.type==='vault-classifier-submit-correction').length") == 2
    page.wait_for_timeout(4100)
    assert not evaljs("testShadows[0].querySelector('.chip-del').classList.contains('armed')")
    evaljs("testShadows[0].querySelector('.chip-del').click()")
    assert evaljs("messages.filter(m=>m.type==='vault-classifier-submit-correction').length") == 2
    evaljs("testShadows[0].querySelector('.chip-del').click()")
    page.wait_for_function("messages.filter(m=>m.type==='vault-classifier-submit-correction').length===3")
    print('PASS click removal requires confirmation and confirmation expires after four seconds')
    if os.getenv('UI_CAPTURE_DIR'):
        page.screenshot(path=str(Path(os.environ['UI_CAPTURE_DIR'])/'tag-ui.png'))
    page.close()
