import time

HTML = '''<!doctype html><html><body><ytd-video-renderer style="display:block;margin:30px">
<a id="thumbnail" href="/watch?v=dQw4w9WgXcQ">Thumbnail</a>
<h3><a id="video-title" href="/watch?v=dQw4w9WgXcQ">Games fixture</a></h3>
<a href="/@VisibleCreator">Visible Creator</a></ytd-video-renderer></body></html>'''

def run(context, worker):
    worker.evaluate('''async () => {
      self.vaultFixture = {active:false, resolved:false, requests:0, ops:[]};
      await chrome.storage.local.set({vaultClassifierSettings:{collectionEnabled:false,taggingMode:'paused'}});
      self.CBClassifierHub = {...self.CBClassifierHub, request:async (operation, body) => {
        self.vaultFixture.ops.push(operation);
        if(operation==='collection-info') return {enabledPlatformIDs:['youtube'],classifierPlatformIDs:self.vaultFixture.active?['youtube']:[],taggingPlatformIDs:self.vaultFixture.active?['youtube']:[]};
        if(operation==='collect') return {accepted:true,inserted:true};
        if(operation==='video-tags-batch') {
          self.vaultFixture.requests++;
          return {platformID:body.platformID,items:body.items.map(item=>({entryID:item.entryID,tags:self.vaultFixture.resolved?[{id:'games',name:'Games',lightColorHex:'#9EC5E8',darkColorHex:'#1A4775'}]:[],pending:!self.vaultFixture.resolved,predicted:false}))};
        }
        return {accepted:true};
      }};
    }''')
    page = context.new_page()
    page.route('https://www.youtube.com/**', lambda route: route.fulfill(status=200, content_type='text/html', body=HTML))
    cdp = context.new_cdp_session(page)
    worlds = []
    cdp.on('Runtime.executionContextCreated', lambda event: worlds.append(event['context']))
    cdp.send('Runtime.enable')
    cdp.send('DOM.enable')
    def text_nodes(node):
        values = [node.get('nodeValue','')]
        for child in node.get('children',[]) + node.get('shadowRoots',[]):
            values.extend(text_nodes(child))
        return values
    def labels():
        return text_nodes(cdp.send('DOM.getDocument', {'depth':-1,'pierce':True})['root'])
    def until(predicate, label):
        end = time.monotonic() + 8
        while not predicate():
            if time.monotonic() > end:
                print('WORKER', worker.evaluate('self.vaultFixture'), flush=True)
                for world in reversed(worlds):
                    if world.get('auxData',{}).get('type') == 'isolated':
                        try:
                            print('WORLD', cdp.send('Runtime.evaluate', {'contextId':world['id'], 'expression':'JSON.stringify({youtube:window.__vaultClassifierYouTube,tagUI:!!window.VaultClassifierTagUI,cards:document.querySelectorAll("ytd-video-renderer").length})','returnByValue':True}), flush=True)
                            print('STATUS', cdp.send('Runtime.evaluate', {'contextId':world['id'], 'expression':'chrome.runtime.sendMessage({type:"vault-classifier-collection-info",platform:"youtube"})','returnByValue':True,'awaitPromise':True}), flush=True)
                        except Exception:
                            pass
                raise AssertionError(label + ': ' + str(labels()))
            page.wait_for_timeout(50)
        print('PASS ' + label, flush=True)
    def state(active, resolved=False):
        worker.evaluate('''([active,resolved]) => {
          self.vaultFixture.active=active; self.vaultFixture.resolved=resolved;
          self.CBClassifierBroadcastReceive({operation:'classifier-state-updated',body:{}});
        }''', [active,resolved])
    page.goto('https://www.youtube.com/results?search_query=vault-fixture')
    page.wait_for_timeout(1200)
    assert 'Tagging' not in labels() and 'None' not in labels()
    assert worker.evaluate('self.vaultFixture.requests') == 0
    print('PASS no Classifier group means no tag pills or classification requests', flush=True)
    state(True)
    until(lambda: 'Tagging' in labels(), 'creating an active group paints pending pills on the already-open page without a blocking filter')
    worker.evaluate('''() => {
      self.vaultFixture.resolved=true;
      self.CBClassifierBroadcastReceive({operation:'video-tags-updated',body:{platformID:'youtube',items:[{entryID:'youtube:video:dQw4w9WgXcQ',tags:[{id:'games',name:'Games',lightColorHex:'#9EC5E8',darkColorHex:'#1A4775'}],predicted:false}]}});
    }''')
    until(lambda: 'Games' in labels() and 'Tagging' not in labels(), 'completed classification replaces the pending pill with its tag')
    state(False, True)
    until(lambda: 'Games' not in labels() and 'Tagging' not in labels() and 'None' not in labels(), 'native pause or global disable hides the pills')
    before = worker.evaluate('self.vaultFixture.requests')
    page.wait_for_timeout(3500)
    assert worker.evaluate('self.vaultFixture.requests') == before
    print('PASS paused page makes no new classification requests', flush=True)
    state(True, True)
    until(lambda: 'Games' in labels(), 'native resume reactivates tags without a page reload')
    page.close()
