"""Real extension popup identity/edit/delete and content-cover controls on Mini1."""
from pathlib import Path
import os

def run(context, worker):
    pages=[]
    alias='site:linked_0123456789abcdef01234567'
    def stored():
        return worker.evaluate('async()=> (await chrome.storage.local.get("blockedGroups")).blockedGroups[0]')
    try:
        context.route('https://**/*',lambda route:route.fulfill(status=200,content_type='text/html',body='<html><head><title>Owned scope fixture</title></head><body><h1>Disposable page</h1></body></html>'))
        worker.evaluate('''async alias => {
          const [g]=sanitizeGroups([{...CBGroupScopes.withoutFlatScopeFields(CBGroupScopes.createDefaultGroup('site')),id:'independent-sites',name:'Independent Websites',enabled:false,mode:'instant',scopes:[
            {surface:'apps',action:'block',apps:[{id:'com.example.Disposable',name:'Disposable peer'}]},
            {surface:'site',action:'block',sites:['example.com'],sitesExcept:false},
            {surface:'site',entryID:alias,action:'pause',sites:['safe.example'],sitesExcept:true}]}]);
          await chrome.storage.local.set({blockedGroups:[g],quickAddGroupId:g.id});
        }''',alias)
        popup=context.new_page();pages.append(popup)
        popup.goto('chrome-extension://'+worker.evaluate('()=>chrome.runtime.id')+'/popup.html')
        popup.wait_for_function('()=> state.groupsLoaded')
        popup.evaluate('async()=>await selectGroup("independent-sites")')
        labels=popup.locator('#groupScopesList .scope-chip > span').all_text_contents()
        assert 'Websites 1' in labels and 'Websites 2' in labels and 'Apps' in labels,labels
        popup.locator('#groupScopesList .scope-chip').filter(has_text='Websites 2').click()
        popup.wait_for_function('()=> activeEntryKey(getSelectedGroup()).startsWith("site:")')
        assert popup.locator('#siteAllowlist').is_checked()
        assert popup.locator('#blockedSitesList').inner_text().find('safe.example')>=0
        # Actual editable checkbox change must update only the selected alias.
        popup.locator('details.editor-more > summary').click()
        popup.locator('#siteAllowlist').uncheck()
        popup.evaluate('async()=>await flushAutosave()')
        group=stored();sites=[s for s in group['scopes'] if s['surface']=='site']
        assert next(s for s in sites if s.get('entryID')==alias)['sitesExcept'] is False
        assert next(s for s in sites if not s.get('entryID'))['sites']==['example.com']
        assert group['scopes'][0]['surface']=='apps'
        popup.locator('#groupScopesList .scope-chip').filter(has_text='Apps').click()
        popup.wait_for_function('()=> activeEntryKey(getSelectedGroup()) === "apps"')
        assert popup.locator('#appsAllowlist').is_disabled()
        popup.locator('#groupScopesList .scope-chip').filter(has_text='Websites 2').click()
        popup.locator('#groupScopesList .scope-chip').filter(has_text='Websites 2').locator('button').click()
        popup.wait_for_function('()=> !CBGroupScopes.groupPlatforms(toStoredGroup(getSelectedGroup())).some(k=>k.startsWith("site:"))')
        group=stored();assert [s['sites'] for s in group['scopes'] if s['surface']=='site']==[['example.com']]
        popup.reload();popup.wait_for_function('()=> state.groupsLoaded')
        assert not any('Websites 2'==x for x in popup.locator('.scope-chip > span').all_text_contents())
        popup.close();pages.remove(popup)
        # Restore two independent predicates; use the real worker/content cover.
        worker.evaluate('''async alias=>{
          const data=await chrome.storage.local.get('blockedGroups');const g=data.blockedGroups[0];
          g.enabled=true;g.scopes.push({id:'site-2',entryID:alias,surface:'site',platform:null,action:'pause',sites:['example.com','safe.example'],sitesExcept:true});
          await chrome.storage.local.set({blockedGroups:sanitizeGroups([g])});
        }''',alias)
        for domain,action in [('example.com','cover'),('other.example','pause'),('safe.example',None)]:
            page=context.new_page();pages.append(page);page.goto('https://'+domain,wait_until='domcontentloaded')
            if action:
                page.locator('dialog[open] .cb-title').wait_for(timeout=15000)
                title=page.locator('dialog[open] .cb-title').inner_text()
                assert title==('Take a moment' if action=='pause' else 'Blocked by Independent Websites'),title
                # Cover and pause show different real overlay controls.
                text=page.locator('dialog[open]').inner_text()
                assert ('Continue' in text)==(action=='pause'),text
            else:
                page.wait_for_timeout(600)
                assert page.locator('dialog[open]').count()==0
            page.close();pages.remove(page)
        print('PASS independent Website UI: numbered tabs, selected alias edit/delete/reload, peer Apps readonly; actual block-over-pause, except pause, unblocked control')
    finally:
        for page in pages:page.close()
        worker.evaluate('async()=>await chrome.storage.local.set({blockedGroups:[],quickAddGroupId:""})')
