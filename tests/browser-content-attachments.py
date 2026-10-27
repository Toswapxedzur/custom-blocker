"""Real development extension; run twice with one private profile for restart."""
import os,time
from pathlib import Path

HTML='''<!doctype html><style>body{font:16px Arial;background:white;padding:40px}ytd-rich-item-renderer{display:block;padding:20px;margin:20px;background:#f1f5f9}h3{display:inline}h1{font-size:24px}</style>
<h1>Fixture feed</h1><ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=attachmentA"><h3 id="video-title">Content A</h3></a></ytd-rich-item-renderer>'''
SOURCE="""(on,v)=>{
 on('tick',()=>{v.state.ticks=(v.state.ticks||0)+1;});
 on('items',({data})=>{for(const item of data.items){
  if(item.attachments===null)continue;
  if(item.contentId==='youtube:video:attachmentA'){v.state.item=item;if(!item.attachments.summary){v.attach(data.tabId,item,'summary',{type:'pill',text:'Saved pill',tone:'blue'});v.state.created=(v.state.created||0)+1;}}
  if(item.isPage&&!item.attachments['page-note']){v.attach(data.tabId,item,'page-note',{type:'pill',text:'Page note',tone:'gold'});v.state.pageSaved=true;}
 }});
 on('attachment',({data})=>{v.state.clicks=(v.state.clicks||0)+1;v.attach(data.tabId,data.item,'summary',{type:'pill',text:'Clicked '+v.state.clicks,tone:'cyan'});v.log('click',data.item.contentId);});
 on('panel',({data})=>{v.state.pendingItem=v.state.item;v.state.tab=data.tabId;v.state.request=v.ai({prompt:'Summarize'});});
 on('ai',({data})=>{if(data.requestId===v.state.request)v.attach(v.state.tab,v.state.pendingItem,'summary',{type:'pill',text:data.text});});
}"""

def run(context,worker):
    assert worker.evaluate('()=>CBLocalHubEnvironment.current.name')=='development'
    context.set_default_timeout(10000)
    context.route('https://www.youtube.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body=HTML))
    def until(predicate,label):
        deadline=time.monotonic()+12
        while not predicate():
            if time.monotonic()>deadline:raise AssertionError('Timed out: '+label)
            time.sleep(.05)
    popup=context.new_page();page=context.new_page();cdp=context.new_cdp_session(page);cdp.send('DOM.enable')
    def buttons(label):
        found=[]
        def visit(node,host=None):
            if node.get('nodeName')=='BUTTON' and any(child.get('nodeValue')==label for child in node.get('children',[])):found.append(dict(node,attachmentHost=host))
            for child in node.get('children',[]):visit(child,host)
            for child in node.get('shadowRoots',[]):visit(child,node['nodeId'])
        visit(cdp.send('DOM.getDocument',{'depth':-1,'pierce':True})['root']);return found
    def click(label,keyboard=False):
        until(lambda:buttons(label),label)
        node=buttons(label)[0]['nodeId']
        if keyboard:cdp.send('DOM.focus',{'nodeId':node});page.keyboard.press('Enter')
        else:
            box=cdp.send('DOM.getBoxModel',{'nodeId':node})['model']['border'];page.mouse.click(sum(box[::2])/4,sum(box[1::2])/4)
    try:
        popup.goto('chrome-extension://'+worker.url.split('/')[2]+'/popup.html')
        until(lambda:popup.evaluate('()=>state.groupsLoaded'),'popup groups loaded')
        phase=os.environ.get('ATTACHMENT_PHASE','1')
        if phase=='1':
            group=popup.evaluate("""async()=>{const g=createDefaultGroup('custom');g.name='Attachment fixture';await chrome.storage.local.set({blockedGroups:[toStoredGroup(g)]});return g.id;}""")
            answer=popup.evaluate("async ({group,source})=>chrome.runtime.sendMessage({type:'run-custom-group',groupId:group,source})",{'group':group,'source':SOURCE})
            assert answer.get('loadResult',{}).get('ok'),answer
        else:
            group=worker.evaluate("async()=> (await chrome.storage.local.get('blockedGroups')).blockedGroups[0].id")
        if phase=='3':
            ticks=worker.evaluate("async id=>(await chrome.storage.local.get('cbRuleState')).cbRuleState[id].ticks||0",group)
            page.goto('https://www.youtube.com/')
            until(lambda:worker.evaluate("async id=>(await chrome.storage.local.get('cbRuleState')).cbRuleState[id].ticks>"+str(ticks),group),'ordinary rule ticks after corrupt-store cold restart')
            assert worker.evaluate("async()=>(await chrome.storage.local.get('cbRuleAttachments')).cbRuleAttachments.version")==999
            assert not buttons('Page note') and not buttons('Clicked 3')
            print('PASS corrupt/future attachment storage survives cold restart without blocking ordinary rule handlers or resetting data',flush=True)
            return
        page.goto('https://www.youtube.com/')
        until(lambda:buttons('Page note'),'saved page pill')
        if phase=='2':
            until(lambda:buttons('Clicked 2'),'saved card pill after full browser restart')
            assert worker.evaluate("async id=>(await chrome.storage.local.get('cbRuleState')).cbRuleState[id].created",group)==1
            click('Clicked 2');until(lambda:buttons('Clicked 3'),'saved click action after restart')
            print('PASS browser restart restores page/card pills and click action without rerunning attachment creation',flush=True)
            worker.evaluate("async()=>chrome.storage.local.set({cbRuleAttachments:{version:999,groups:{keep:'future'}}})")
            return
        until(lambda:buttons('Saved pill'),'saved card pill')
        click('Saved pill');until(lambda:buttons('Clicked 1'),'pointer click delivered to rule')
        click('Clicked 1',keyboard=True);until(lambda:buttons('Clicked 2'),'Enter delivered to rule')
        assert page.url=='https://www.youtube.com/'
        print('PASS real page/card pills, pointer/keyboard actions and no underlying card navigation',flush=True)
        for label in ['Clicked 2','Page note']:
            cdp.send('DOM.removeNode',{'nodeId':buttons(label)[0]['attachmentHost']})
            until(lambda:buttons(label),'site-removed attachment host repaired')
        print('PASS site-removed card/page pill hosts remount without repeating rule work',flush=True)
        # Recycle the same DOM card while an AI response still holds its old
        # content handle. It cannot save/display the result on content B.
        worker.evaluate("()=>{globalThis.CBRuleAIHub={request:()=>new Promise(resolve=>{globalThis.__attachmentAI=resolve;})};}")
        tab=worker.evaluate("async()=> (await chrome.tabs.query({})).find(t=>t.url==='https://www.youtube.com/').id")
        worker.evaluate("async ({group,tab})=>dispatchRule('panel',{tabId:tab},{targetGroupId:group})",{'group':group,'tab':tab})
        until(lambda:worker.evaluate("()=>typeof __attachmentAI==='function'"),'AI queued')
        page.evaluate("document.querySelector('#thumbnail').href='/watch?v=attachmentB';document.querySelector('#video-title').textContent='Content B';")
        until(lambda:not buttons('Clicked 2'),'old pill lifted from recycled card')
        worker.evaluate("()=>__attachmentAI({ok:true,text:'Late AI must not attach',citations:[]})")
        until(lambda:popup.evaluate("async id=>(await chrome.runtime.sendMessage({type:'get-log-feed',groupId:id})).entries.some(e=>e.message.includes('attachment-stale-target'))",group),'explicit stale AI rejection in rule Log')
        assert not buttons('Late AI must not attach')
        doc=worker.evaluate("async()=> (await chrome.storage.local.get('cbRuleAttachments')).cbRuleAttachments")
        assert 'youtube:video:attachmentB' not in doc['groups'][group]
        assert doc['groups'][group]['youtube:video:attachmentA']['summary']['spec']['text']=='Clicked 2'
        page.evaluate("document.querySelector('#thumbnail').href='/watch?v=attachmentA';document.querySelector('#video-title').textContent='Content A';")
        until(lambda:buttons('Clicked 2'),'same content restores saved pill after recycling')
        print('PASS recycled content rejects stale AI mutation and restores content-owned saved pill',flush=True)
        worker.evaluate("async id=>{const r=await chrome.storage.local.get('blockedGroups');r.blockedGroups[0].enabled=false;await chrome.storage.local.set(r);}",group)
        until(lambda:not buttons('Clicked 2') and not buttons('Page note'),'disable lifts attachments')
        assert worker.evaluate("async()=>Object.keys((await chrome.storage.local.get('cbRuleAttachments')).cbRuleAttachments.groups).length")==1
        worker.evaluate("async()=>{const r=await chrome.storage.local.get('blockedGroups');r.blockedGroups[0].enabled=true;await chrome.storage.local.set(r);}")
        until(lambda:buttons('Clicked 2') and buttons('Page note'),'reenable restores attachments')
        page.reload();until(lambda:buttons('Clicked 2') and buttons('Page note'),'navigation restores saved pills')
        context.route('https://attachment.test/**',lambda route:route.fulfill(status=200,content_type='text/html',body='<h1>Generic content page</h1>'))
        page.goto('https://attachment.test/read');until(lambda:buttons('Page note'),'generic web page pill')
        assert worker.evaluate("async id=>!!(await chrome.storage.local.get('cbRuleAttachments')).cbRuleAttachments.groups[id]['web:url:https://attachment.test/read']",group)
        page.goto('https://www.youtube.com/');until(lambda:buttons('Clicked 2') and buttons('Page note'),'return from generic page')
        page.screenshot(path=str(Path.cwd().parent/'content-attachments.png'))
        print('PASS disable/reenable, generic web pages and navigation preserve saved attachments',flush=True)
    except Exception:
        print('FIXTURE STATE',worker.evaluate("async()=>({types:[...cbRuleTypes].map(([id,t])=>[id,[...t]]),needs:cbRulePageNeeds(),store:await chrome.storage.local.get(['cbRuleAttachments','cbRuleState']),logs:typeof cbLogFeed!=='undefined'?cbLogFeed:null})"),flush=True)
        page.screenshot(path=str(Path.cwd().parent/'content-attachments-negative.png'))
        raise
    finally:
        cdp.detach();page.close();popup.close()
