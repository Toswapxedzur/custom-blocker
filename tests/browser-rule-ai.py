"""Run through the existing extension driver; fixture broker, real worker/pages."""
import http.server
import threading
import time
from pathlib import Path


def run(context, service_worker):
    context.set_default_timeout(10000)
    def until(expression):
        deadline=time.monotonic()+10
        while not service_worker.evaluate('()=>'+expression):
            if time.monotonic()>deadline:raise AssertionError('Timed out: '+expression)
            time.sleep(0.025)
    assert service_worker.evaluate("() => CBLocalHubEnvironment.current.name") == "development"
    service_worker.evaluate("""() => {
      globalThis.__aiFixtureCalls=[];
      globalThis.CBRuleAIHub={request:(operation,groupId,payload)=>{
        if(operation==='models')return Promise.resolve({ok:true,models:[{value:'api:fixture:gpt-5',accountID:'',label:'OpenAI API · Fixture',efforts:['default','low','medium','high']}]});
        __aiFixtureCalls.push({groupId,payload});
        return new Promise(resolve=>{globalThis.__aiFixtureReply=resolve;});
      }};
    }""")
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers()
            self.wfile.write(b'<!doctype html><title>Runtime AI fixture</title><h1>Original fixture page</h1>')
        def log_message(self,*_):
            pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    page=context.new_page();popup=context.new_page()
    try:
        page.goto('http://127.0.0.1:'+str(server.server_port))
        popup.goto('chrome-extension://'+service_worker.url.split('/')[2]+'/popup.html')
        popup.wait_for_function("typeof render==='function' && typeof state==='object'")
        group=popup.evaluate("""async()=>{
          const group=createDefaultGroup('custom');group.name='Runtime AI fixture';
          await chrome.storage.local.set({blockedGroups:[toStoredGroup(group)]});
          state.groups=[group];state.selectedGroupId=group.id;state.drafts={};render();
          document.getElementById('ruleAISettings').open=true;
          return group.id;
        }""")
        popup.wait_for_function("document.getElementById('ruleAIModel').options.length===2")
        popup.locator('label').filter(has=popup.locator('#ruleAIModel')).locator('.vui-select-button').click()
        popup.locator('.vui-menu-item').filter(has_text='OpenAI API · Fixture').click()
        popup.locator('label').filter(has=popup.locator('#ruleAIEffort')).locator('.vui-select-button').click()
        popup.locator('.vui-menu-item').filter(has_text='Low').click()
        popup.fill('#ruleAICap','7');popup.locator('#ruleAICap').dispatch_event('change')
        saved=popup.evaluate("""async()=>{await flushAutosave();return (await chrome.storage.local.get('blockedGroups')).blockedGroups[0].ruleAI;}""")
        assert saved=={'providerModel':'api:fixture:gpt-5','accountID':'','reasoningEffort':'low','dailyRequestLimit':7},saved
        print('PASS actual extension editor persists model, effort and cap through worker',flush=True)
        tab=service_worker.evaluate("async()=> (await chrome.tabs.query({})).find(t=>t.title==='Runtime AI fixture').id")
        source="""(on,v)=>{let tab;on('panel',({data})=>{tab=data.tabId;v.ai({prompt:'Summarize',input:{text:'fixture'}});});on('ai',({data})=>{v.state.answer=data.text;v.cover(tab,data.ok,data.text);v.log(data.error||data.text);});}"""
        loaded=popup.evaluate("async ({group,source})=>await chrome.runtime.sendMessage({type:'run-custom-group',groupId:group,source})",{'group':group,'source':source})
        assert loaded.get('loadResult',{}).get('ok') is True,loaded
        service_worker.evaluate("async ({group,tab})=>await dispatchRule('panel',{tabId:tab},{targetGroupId:group})",{'group':group,'tab':tab})
        until("__aiFixtureCalls.length===1")
        service_worker.evaluate("()=>__aiFixtureReply({ok:true,text:'AI fixture says pause',citations:[],error:''})")
        page.locator('#cb-vault-cover').wait_for(state='visible')
        assert 'AI fixture says pause' in page.locator('#cb-vault-cover').inner_text()
        print('PASS actual rule AI event drives a visible page cover',flush=True)
        # Disable lifts the real cover; a response from before a replacement
        # Run must not reapply it to the new instance.
        service_worker.evaluate("async ({group,tab})=>await dispatchRule('panel',{tabId:tab},{targetGroupId:group})",{'group':group,'tab':tab})
        until("__aiFixtureCalls.length===2")
        replacement="(on,v)=>{on('ai',()=>{v.cover('*',true,'STALE RESULT');});}"
        loaded=popup.evaluate("async ({group,source})=>await chrome.runtime.sendMessage({type:'run-custom-group',groupId:group,source})",{'group':group,'source':replacement})
        assert loaded.get('loadResult',{}).get('ok') is True,loaded
        service_worker.evaluate("()=>__aiFixtureReply({ok:true,text:'late',citations:[],error:''})")
        page.wait_for_timeout(200)
        assert 'STALE RESULT' not in page.locator('body').inner_text()
        print('PASS actual extension Run discards the previous pending AI response',flush=True)
        popup.screenshot(path=str(Path.cwd().parent/'browser-rule-ai.png'),full_page=True)
    finally:
        page.close();popup.close();server.shutdown();server.server_close();thread.join()
