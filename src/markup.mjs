// Render this game's fixed HTML/SVG template vocabulary without HTML injection sinks.
// Dynamic text must still be escaped by the caller, as it is in app.mjs.
export function markup(element) {
  return {set html(source) {
    const doc=element.ownerDocument,root=doc.createDocumentFragment(),stack=[root];
    const tags=new Set('main header footer section aside nav div span small strong b i em p h1 h2 h3 button canvas dialog details summary label input form select option ol li article svg path circle br img'.split(' '));
    const safeImageSrc=value=>{const src=value.trim();return src.startsWith('blob:')||/^assets\/avatars\/[\w.-]+$/.test(src);};
    const decode=text=>text.replace(/&(?:amp|lt|gt|quot|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity]));
    const tokens=/<!--[^]*?-->|<\/[a-z][a-z0-9-]*\s*>|<[a-z][a-z0-9-]*(?:\s+[a-zA-Z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*\s*\/?>|[^<]+/gy;
    let end=0;
    for(const match of source.matchAll(tokens)){
      const token=match[0];end=match.index+token.length;
      if(token.startsWith('<!--'))continue;
      if(token.startsWith('</')){if(stack.length===1||stack.at(-1).localName!==token.slice(2,-1).trim())throw Error('Invalid template closing tag');stack.pop();continue;}
      if(!token.startsWith('<')){stack.at(-1).append(doc.createTextNode(decode(token)));continue;}
      const tag=token.match(/^<([a-z][a-z0-9-]*)/)[1];
      if(!tags.has(tag))throw Error('Unsupported template element: '+tag);
      const parent=stack.at(-1),svg=tag==='svg'||parent.namespaceURI==='http://www.w3.org/2000/svg';
      const node=svg?doc.createElementNS('http://www.w3.org/2000/svg',tag):doc.createElement(tag);
      const attributes=token.slice(tag.length+1).replace(/\/?\s*>$/,'');
      for(const attr of attributes.matchAll(/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)){
        if(/^on/i.test(attr[1])||/^(?:href|srcset|srcdoc|formaction|xlink:href)$/i.test(attr[1]))throw Error('Unsupported template attribute: '+attr[1]);
        const value=decode(attr[2]??attr[3]??'');
        if(attr[1]==='src'){
          if(tag!=='img'||!safeImageSrc(value))throw Error('Unsupported template attribute: src');
          node.setAttribute('src',value);continue;
        }
        // style attributes are blocked by the platform CSP; CSSOM writes are allowed.
        if(attr[1]==='style'){
          for(const declaration of value.split(';')){
            const colon=declaration.indexOf(':');
            if(colon!==-1)node.style.setProperty(declaration.slice(0,colon).trim(),declaration.slice(colon+1).trim());
          }
        }else node.setAttribute(attr[1],value);
      }
      parent.append(node);
      if(!['input','br','img'].includes(tag)&&!token.endsWith('/>'))stack.push(node);
    }
    if(end!==source.length||stack.length!==1)throw Error('Invalid game template');
    element.replaceChildren(root);
  }};
}
