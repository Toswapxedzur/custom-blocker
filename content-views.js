/* Passive HTML/SVG attachments. Interaction stays in the rule, not in markup. */
(function(root){
  'use strict';
  const htmlTags=new Set('a abbr b blockquote br button caption code col colgroup dd details div dl dt em fieldset figcaption figure form h1 h2 h3 h4 h5 h6 hr i input label legend li mark meter ol optgroup option p pre progress s section select small span strong sub summary sup table tbody td textarea th thead tr u ul'.split(' '));
  const svgTags=new Set('svg g path circle ellipse rect line polyline polygon text tspan defs linearGradient radialGradient stop'.split(' '));
  const blocked=new Set('script style iframe object embed link meta base template noscript foreignobject'.split(' '));
  const attrs=new Set('id class title role aria-label aria-hidden aria-expanded aria-pressed aria-describedby tabindex data-control data-value name value placeholder min max step rows cols checked selected disabled multiple open for colspan rowspan scope width height viewBox d x y x1 x2 y1 y2 cx cy r rx ry points fill stroke stroke-width stroke-linecap stroke-linejoin opacity offset stop-color stop-opacity preserveAspectRatio'.split(' '));
  const badCSS=/\\|(?:url|var|env|attr|image-set|-webkit-image-set|cross-fade|paint|element|expression)\s*\(|@(?:import|font-face|namespace)|behavior\s*:|-moz-binding/i;
  const property=/^(?:color|background(?:-color)?|opacity|display|visibility|position|inset(?:-.+)?|top|right|bottom|left|z-index|width|min-width|max-width|height|min-height|max-height|box-sizing|overflow(?:-.+)?|overscroll-behavior(?:-.+)?|margin(?:-.+)?|padding(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|box-shadow|text-shadow|font(?:-.+)?|line-height|letter-spacing|word-spacing|white-space|word-break|overflow-wrap|text-.+|vertical-align|list-style-type|list-style-position|flex(?:-.+)?|grid(?:-.+)?|gap|row-gap|column-gap|align-.+|justify-.+|place-.+|order|float|clear|transform(?:-.+)?|transition(?:-.+)?|animation(?:-.+)?|cursor|user-select|appearance|accent-color|fill|stroke(?:-.+)?)$/;
  function cssText(raw,doc){
    const source=String(raw||'').replace(/\/\*[\s\S]*?\*\//g,'');
    if(badCSS.test(source))return '';
    const inert=doc.implementation.createHTMLDocument(''),style=inert.createElement('style');
    style.textContent=source;inert.head.append(style);
    const declarations=style=>[...style].filter(key=>property.test(key)).map(key=>`${key}:${style.getPropertyValue(key)}${style.getPropertyPriority(key)?'!important':''};`).join('');
    function rules(list){let result='';for(const rule of list||[]){
      if(rule.type===1){
        const selectors=rule.selectorText.split(',').filter(s=>!/:host|::slotted|::part/i.test(s)).map(s=>'.vault-content-view '+s.trim());
        if(selectors.length)result+=selectors.join(',')+'{'+declarations(rule.style)+'}';
      }else if(rule.type===4||rule.type===12){result+=`@${rule.type===4?'media':'supports'} ${rule.conditionText}{${rules(rule.cssRules)}}`;}
      else if(rule.type===7){result+='@keyframes '+rule.name+'{'+[...rule.cssRules].map(frame=>frame.keyText+'{'+declarations(frame.style)+'}').join('')+'}';}
    }return result;}
    try{return rules(style.sheet?.cssRules);}catch{return '';}
  }
  function create(spec,doc,send){
    const template=doc.createElement('template');template.innerHTML=spec.html;
    const view=doc.createElement('span');view.className='vault-content-view';
    view.style.cssText='display:inline-block;position:relative;isolation:isolate;contain:layout paint style;max-width:100%;max-height:480px;overflow:auto;vertical-align:middle;box-sizing:border-box';
    if(spec.label){view.setAttribute('role','group');view.setAttribute('aria-label',spec.label);}
    let count=0;const ids=new Set();
    function clean(node,depth){
      if(++count>1000||depth>24)return null;
      if(node.nodeType===3)return doc.createTextNode(node.textContent);
      if(node.nodeType!==1)return null;
      const lower=node.localName.toLowerCase();if(blocked.has(lower))return null;
      const svg=node.namespaceURI==='http://www.w3.org/2000/svg';
      if(!(svg?svgTags.has(node.localName):htmlTags.has(lower))){const fragment=doc.createDocumentFragment();for(const child of node.childNodes){const next=clean(child,depth+1);if(next)fragment.append(next);}return fragment;}
      const element=svg?doc.createElementNS(node.namespaceURI,node.localName):doc.createElement(lower);
      for(const attribute of node.attributes){
        if(attrs.has(attribute.name)&&attribute.value.length<=2000&&(!['fill','stroke','stop-color'].includes(attribute.name)||!badCSS.test(attribute.value)))element.setAttribute(attribute.name,attribute.value);
      }
      const control=node.getAttribute('data-control')||node.id;
      if(control&&/^[A-Za-z0-9_-]{1,80}$/.test(control)&&!ids.has(control)){
        element.setAttribute('data-control',control);ids.add(control);
        if(!svg&&!['button','input','select','textarea','summary'].includes(lower)){element.setAttribute('role','button');element.tabIndex=0;}
      }else element.removeAttribute('data-control');
      if(lower==='button')element.type='button';
      if(lower==='input'){
        element.type=['text','search','email','url','password','number','checkbox','radio','range','color','date','time'].includes(node.getAttribute('type'))?node.getAttribute('type'):'text';
        element.setAttribute('autocomplete','off');
      }
      if(['input','textarea','select'].includes(lower))element.setAttribute('autocomplete','off');
      for(const child of node.childNodes){const next=clean(child,depth+1);if(next)element.append(next);}
      return element;
    }
    for(const child of template.content.childNodes){const element=clean(child,0);if(element)view.append(element);}
    function value(node){
      if(node.localName==='input'&&['checkbox','radio'].includes(node.type))return node.checked;
      if(node.localName==='select'&&node.multiple)return [...node.selectedOptions].slice(0,32).map(o=>o.value.slice(0,2000));
      return String(node.value??node.getAttribute('data-value')??'').slice(0,2000);
    }
    function emit(event,name){
      if(!event.isTrusted)return;
      const control=event.target.closest?.('[data-control]');
      if(!control)return;
      const values=Object.create(null);
      for(const node of view.querySelectorAll('input[data-control],select[data-control],textarea[data-control]')){
        if(Object.keys(values).length>=32)break;
        values[node.getAttribute('data-control')]=value(node);
      }
      const body={eventName:name,controlId:control?.getAttribute('data-control')||'',value:control?value(control):null,values};
      if(JSON.stringify(body).length<=16000)send(body);
    }
    for(const name of ['click','input','change'])view.addEventListener(name,event=>{if(name==='click'&&!event.target.closest?.('input,select,textarea,label,summary'))event.preventDefault();event.stopPropagation();emit(event,name);});
    view.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();});
    view.addEventListener('keydown',event=>{
      const control=event.target.closest?.('[data-control]');
      if(control&&!['button','input','select','textarea','summary'].includes(control.localName)&&['Enter',' '].includes(event.key)){
        event.preventDefault();emit(event,'click');
      }
    });
    const style=doc.createElement('style');style.textContent=cssText(spec.css,doc);
    const host=doc.createElement('span');host.style.cssText='all:initial;display:inline-block;max-width:100%;vertical-align:middle';
    const shadow=host.attachShadow({mode:'closed'});shadow.append(style,view);
    return {element:host};
  }
  root.VaultContentViews=Object.freeze({create,cssText});
})(typeof globalThis!=='undefined'?globalThis:this);
