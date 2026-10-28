"""Real isolated extension: generic policy code, data, views and trusted input."""
import os,time
from pathlib import Path

HTML='''<!doctype html><style>body{font:16px Arial;background:white;padding:40px}ytd-rich-item-renderer{display:block;padding:20px;margin:20px;background:#f1f5f9}h3{display:inline}</style><h1>Generic content fixture</h1><ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=genericA"><h3 id="video-title">Content A</h3></a></ytd-rich-item-renderer>'''
EXTRA="""(on,v)=>{on('items',({data})=>{for(const item of data.items)if(item.contentId==='youtube:video:genericA'){
 v.attach(data.tabId,item,'independent',{type:'html',html:'<section class="note">Group B</section>',css:'.note{background:#FCE7F3;padding:8px}'});
 v.store({op:'put',key:'answer:'+item.contentId,value:{label:'Independent B'}});
}});}"""
SECURITY="""(on,v)=>{on('items',({data})=>{for(const item of data.items)if(item.contentId==='youtube:video:genericA'){
 v.attach(data.tabId,item,'unsafe',{type:'html',html:'<script>window.__genericExecuted=1</script><style>body{background:red}</style><img src="https://attachment.invalid/image"><iframe src="https://attachment.invalid/frame"></iframe><button data-control="safe" onclick="window.__genericExecuted=2">Safe markup</button>',css:'@import "https://attachment.invalid/style";button{background:url(https://attachment.invalid/image)}'});
 v.attach(data.tabId,item,'bounds',{type:'html',html:'<div class="box">Clipped<span class="escape">Escape paint</span></div>',css:'.box{width:80px;height:20px}.escape{position:fixed;left:0;top:0;width:10000px;height:10000px;background:red}'});
}});}"""

def run(context,worker):
    context.set_default_timeout(12000)
    attempted=[]
    context.on('request',lambda request:attempted.append(request.url) if 'attachment.invalid' in request.url else None)
    context.route('https://www.youtube.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body=HTML))
    context.route('https://attachment.invalid/**',lambda route:route.abort())
    popup=context.new_page();page=context.new_page();cdp=context.new_cdp_session(page)
    cdp.send('DOM.enable');cdp.send('CSS.enable')
    def until(predicate,label):
        deadline=time.monotonic()+15
        while not predicate():
            if time.monotonic()>deadline:
                try:print('DIAGNOSTIC',label,state(group),record(group),worker.evaluate('()=>({calls:__genericCalls})'),flush=True)
                except Exception:pass
                raise AssertionError('Timed out: '+label)
            time.sleep(.05)
    def nodes(tag=None,text=None,control=None,cls=None):
        result=[]
        def visit(node):
            attributes=dict(zip(node.get('attributes',[])[::2],node.get('attributes',[])[1::2]))
            if (tag is None or node.get('nodeName')==tag) and (control is None or attributes.get('data-control')==control) and (cls is None or cls in attributes.get('class','').split()) and (text is None or any(child.get('nodeValue')==text for child in node.get('children',[]))):result.append(node)
            for child in node.get('children',[]):visit(child)
            for child in node.get('shadowRoots',[]):visit(child)
        visit(cdp.send('DOM.getDocument',{'depth':-1,'pierce':True})['root'])
        return result
    def click(control=None,text=None):
        until(lambda:nodes(tag='BUTTON',control=control,text=text),'button '+str(control or text))
        node=nodes(tag='BUTTON',control=control,text=text)[0]
        box=cdp.send('DOM.getBoxModel',{'nodeId':node['nodeId']})['model']['border']
        page.mouse.click(sum(box[::2])/4,sum(box[1::2])/4)
    def state(group):return worker.evaluate("async id=>(await chrome.storage.local.get('cbRuleState')).cbRuleState?.[id]||{}",group)
    def record(group,key='answer:youtube:video:genericA'):
        return worker.evaluate("async ({id,key})=>(await chrome.storage.local.get('cbRuleRecords')).cbRuleRecords?.groups?.[id]?.[key]||null",{'id':group,'key':key})
    def create(name,source):
        group=popup.evaluate("async name=>{const g=createDefaultGroup('custom');g.name=name;const old=(await chrome.storage.local.get({blockedGroups:[]})).blockedGroups;await chrome.storage.local.set({blockedGroups:[...old,toStoredGroup(g)]});return g.id;}",name)
        answer=popup.evaluate("async ({group,source})=>chrome.runtime.sendMessage({type:'run-custom-group',groupId:group,source})",{'group':group,'source':source})
        assert answer.get('loadResult',{}).get('ok'),answer
        return group
    try:
        popup.goto('chrome-extension://'+worker.url.split('/')[2]+'/popup.html')
        until(lambda:popup.evaluate('()=>state.groupsLoaded'),'popup')
        worker.evaluate("()=>cbConnection.stop()")
        worker.evaluate("""()=>{globalThis.__genericCalls=0;globalThis.__genericHold=false;globalThis.CBRuleAIHub={request:async()=>{__genericCalls++;if(__genericHold)return new Promise(resolve=>globalThis.__genericRelease=resolve);return {ok:true,text:'{"label":"Study"}'};},disconnected(){},receive(){}};}""")
        phase=os.environ.get('ATTACHMENT_PHASE','1')
        if phase=='1':
            group=create('Generic example',Path('code-manual/generic-example.js').read_text())
            other=create('Independent view',EXTRA);security=create('Passive markup',SECURITY)
        else:
            groups=worker.evaluate("async()=>(await chrome.storage.local.get('blockedGroups')).blockedGroups")
            group=next(g['id'] for g in groups if g['name']=='Generic example')
            other=next(g['id'] for g in groups if g['name']=='Independent view')
        page.goto('https://www.youtube.com/')
        if phase=='3':
            until(lambda:state(group).get('lastStoreError')=='store-unavailable','isolated unavailable store')
            ticks=state(group).get('ticks',0);until(lambda:state(group).get('ticks',0)>ticks,'ordinary ticks with unavailable data')
            assert worker.evaluate("async()=>(await chrome.storage.local.get('cbRuleRecords')).cbRuleRecords.version")==999
            assert nodes(text='Human feedback')
            print('PASS future record data preserved; ordinary rules and saved HTML still work',flush=True)
            return
        until(lambda:nodes(tag='BUTTON',control='save'),'saved HTML editor')
        if phase=='2':
            until(lambda:nodes(text='Human feedback'),'user value after full browser restart')
            assert record(group)['value']=={'label':'Human feedback','origin':'user'}
            assert worker.evaluate('()=>__genericCalls')==0,'human feedback avoids another AI call after restart'
            worker.evaluate("async()=>chrome.storage.local.set({cbRuleRecords:{version:999,groups:{keep:'future'}}})")
            print('PASS record/HTML persistence and current handlers across full normal browser restart; no AI replay',flush=True)
            return
        until(lambda:record(group) and record(group)['value']['label']=='Study','AI result saved by rule code')
        assert record(other)['value']['label']=='Independent B'
        until(lambda:nodes(tag='SECTION',cls='note') and len(nodes(tag='SECTION',cls='note'))>=2,'separate HTML views')
        colors=[]
        for node in nodes(tag='SECTION',cls='note'):
            style={v['name']:v['value'] for v in cdp.send('CSS.getComputedStyleForNode',{'nodeId':node['nodeId']})['computedStyle']}
            colors.append(style.get('background-color'))
        assert 'rgb(207, 250, 254)' in colors and 'rgb(252, 231, 243)' in colors,colors
        assert page.evaluate('()=>window.__genericExecuted') is None
        assert not attempted,attempted
        assert not nodes(tag='IFRAME') and not nodes(tag='SCRIPT',text='window.__genericExecuted=1')
        assert page.evaluate("()=>{const n=document.querySelector('h1'),r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n}")
        print('PASS independent rule records, isolated CSS, passive HTML, no scripts/resources/navigation or viewport escape',flush=True)
        worker.evaluate('()=>__genericHold=true');click(control='refresh')
        until(lambda:worker.evaluate('()=>typeof __genericRelease==="function"'),'held second AI call')
        field=nodes(tag='INPUT',control='answer')[0];cdp.send('DOM.focus',{'nodeId':field['nodeId']})
        page.keyboard.press('Meta+A');page.keyboard.type('Human feedback');click(control='save')
        until(lambda:record(group)['value'].get('origin')=='user','trusted feedback persisted')
        worker.evaluate("()=>{__genericRelease({ok:true,text:'{\"label\":\"Leisure\"}'});__genericHold=false;}")
        until(lambda:state(group).get('lastStoreError')=='store-conflict','late AI loses compare-and-swap')
        assert record(group)['value']['label']=='Human feedback'
        until(lambda:nodes(text='Human feedback'),'feedback remains displayed')
        assert state(group).get('lastOrigin')=='user'
        check=nodes(tag='INPUT',control='check')[0];box=cdp.send('DOM.getBoxModel',{'nodeId':check['nodeId']})['model']['border'];page.mouse.click(sum(box[::2])/4,sum(box[1::2])/4)
        until(lambda:state(group).get('checkbox') is True,'checkbox input/change')
        assert page.url=='https://www.youtube.com/'
        click(control='report');until(lambda:any('Observed visible time:' in str(child.get('nodeValue','')) for node in nodes(tag='P') for child in node.get('children',[])),'rule-code report')
        until(lambda:record(group,'usage:visible') is not None,'rule usage records')
        print('PASS pointer/keyboard input, genuine event origin, rule-code usage report, user feedback beats late AI',flush=True)
        page.evaluate("()=>{document.querySelector('#thumbnail').href='/watch?v=genericB';document.querySelector('#video-title').textContent='Content B'}")
        until(lambda:not nodes(tag='BUTTON',control='save'),'recycled card removes old controls')
        assert record(group)['value']['label']=='Human feedback'
        page.evaluate("()=>{document.querySelector('#thumbnail').href='/watch?v=genericA';document.querySelector('#video-title').textContent='Content A'}")
        until(lambda:nodes(text='Human feedback'),'returning content restores HTML')
        worker.evaluate("async id=>{const r=await chrome.storage.local.get('blockedGroups');r.blockedGroups.find(g=>g.id===id).enabled=false;await chrome.storage.local.set(r)}",other)
        until(lambda:not nodes(text='Group B'),'disable lifts only own view');assert record(other)
        worker.evaluate("async id=>{const r=await chrome.storage.local.get('blockedGroups');r.blockedGroups.find(g=>g.id===id).enabled=true;await chrome.storage.local.set(r)}",other)
        until(lambda:nodes(text='Group B'),'reenable restores independent view')
        worker.evaluate("async id=>{const r=await chrome.storage.local.get('blockedGroups');r.blockedGroups=r.blockedGroups.filter(g=>g.id!==id);await chrome.storage.local.set(r)}",other)
        until(lambda:record(other) is None,'deleted group prunes records')
        # Restart phases still need a second group entry, with no source/records.
        popup.evaluate("async id=>{const r=await chrome.storage.local.get('blockedGroups');const g=createDefaultGroup('custom');g.id=id;g.name='Independent view';r.blockedGroups.push(toStoredGroup(g));await chrome.storage.local.set(r)}",other)
        page.screenshot(path=str(Path(os.environ['EXT_DIR']).parent/'generic-content.png'))
        print('PASS recycle, restore, per-group disable/enable and deletion cleanup',flush=True)
    finally:
        cdp.detach();page.close();popup.close()
