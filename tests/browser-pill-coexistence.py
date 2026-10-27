"""Shared host placement and independent classifier/custom pill lifecycles."""
import time,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run(context,worker):
    page=context.new_page()
    def until(expression):
        end=time.monotonic()+10
        while not page.evaluate('()=>'+expression):
            if time.monotonic()>end:raise AssertionError(expression)
            time.sleep(.025)
    try:
        page.set_content('<body style="font:16px Arial;padding:40px;background:#fff"><article><a href="https://youtube.com/watch?v=fixture1234"><h3>Shared content fixture</h3></a></article></body>')
        page.evaluate("""()=>{
          window.roots=[];const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const root=attach.call(this,options);roots.push(root);return root;};
          window.messages=[];window.chrome={runtime:{id:'fixture',lastError:null,onMessage:{addListener(){}},sendMessage(message,callback){
            messages.push(message);const tag={id:'science',name:'Science',lightColorHex:'#9EC5E8',darkColorHex:'#1A4775'};
            const result={ok:true,platformID:'youtube',entryID:message.entryID,tags:[tag],pending:false};
            if(message.type==='vault-classifier-video-tags-batch')result.items=message.items.map(item=>({...result,entryID:item.entryID}));
            if(message.type==='vault-classifier-classifier-taxonomy')result.types=[{typeID:'group',tags:[tag]}];
            setTimeout(()=>callback?.(result),0);
          }}};
        }""")
        for name in ['content-items.js','vault-classifier-contract.js','vault-classifier-tag-ui.js']:page.add_script_tag(path=str(ROOT/name))
        page.evaluate("()=>VaultClassifierTagUI.observe({platform:'youtube',entryID:'youtube:video:fixture1234',creatorID:'youtube:channel:fixture',title:'Shared content fixture',root:document.querySelector('article'),anchor:document.querySelector('h3')})")
        until("roots[0]?.querySelector('.chip-del')")
        page.evaluate("""()=>{
          window.clicked=[];window.custom=VaultContentItems.createPage({onClick:event=>clicked.push(event)});custom.setEpoch(1);
          window.handle=custom.observe(document.querySelector('article'),{ref:'i1',platform:'youtube',url:'https://youtube.com/watch?v=fixture1234',anchor:document.querySelector('h3')});
          custom.snapshot({pageToken:custom.token,itemsEpoch:1,sequence:1,items:[{target:handle,attachments:[{groupId:'g',id:'note',revision:'one',spec:{type:'pill',text:'Custom note',tone:'blue'}}]}]});
        }""")
        assert page.evaluate("()=>roots[0].host.isConnected&&roots[1].host.isConnected")
        page.evaluate("()=>roots[1].querySelector('button').focus()")
        page.keyboard.press('Enter');assert page.evaluate('()=>clicked.length')==1
        # A classifier correction repaints only its own slot.
        page.evaluate("()=>roots[0].querySelector('.chip-del').click()")
        until("messages.some(m=>m.type==='vault-classifier-submit-correction')")
        assert page.evaluate("()=>roots[1].host.isConnected&&roots[1].querySelector('button').textContent==='Custom note'")
        page.evaluate('()=>custom.setEpoch(0)')
        assert page.evaluate('()=>!roots[1].host.isConnected&&roots[0].host.isConnected')
        print('PASS shared content host: classifier correction and custom click/disable remain independent',flush=True)
        if os.environ.get('UI_CAPTURE_DIR'):page.screenshot(path=str(Path(os.environ['UI_CAPTURE_DIR'])/'pill-coexistence.png'))
    finally:page.close()
