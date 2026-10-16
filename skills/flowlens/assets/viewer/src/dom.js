export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'disabled') node.disabled = Boolean(value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

const paths = {
  flow:['M4 5h6v6H4z','M14 13h6v6h-6z','M7 11v5h7','M10 8h7v5'],
  grid:['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z'],
  page:['M6 3h8l4 4v14H6z','M14 3v5h4','M9 12h6M9 16h6'],
  chevron:['m9 5 7 7-7 7'], down:['m6 9 6 6 6-6'],
  search:['M21 21l-5-5','M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
  play:['m8 4 12 8-12 8z'], plus:['M12 5v14M5 12h14'], minus:['M5 12h14'],
  fit:['M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5'],
  upload:['M12 16V3m-5 5 5-5 5 5','M4 16v5h16v-5'], download:['M12 3v13m-5-5 5 5 5-5','M4 16v5h16v-5'],
  help:['M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4','M12 17h.01','M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  close:['m6 6 12 12M6 18 18 6'], arrow:['M4 12h16m-6-6 6 6-6 6'],
  back:['M20 12H4m6-6-6 6 6 6'], reset:['M3 10a9 9 0 1 1 2 8','M3 3v7h7'],
  hand:['M8 13V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2'],
  pointer:['m5 3 14 9-7 1-3 7z'], check:['m5 12 4 4L19 6'],
  info:['M12 11v6M12 7h.01','M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  branches:['M7 4v12a4 4 0 0 0 4 4h6','M7 8h6a4 4 0 0 0 4-4','m14 17 3 3-3 3','m14 2 3 2-3 3'],
  user:['M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0','M4 21v-2a8 8 0 0 1 16 0v2'],
  link:['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2','M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2'],
  code:['m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16'],
  layers:['m12 3 10 6-10 6L2 9z','m2 14 10 6 10-6'],
  expand:['M8 3H3v5M16 21h5v-5','M3 3l7 7M21 21l-7-7'],
  clock:['M12 6v6l4 2','M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
};

export function icon(name, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  for (const [key,value] of Object.entries({width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.65,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(key,value);
  for (const d of paths[name] ?? paths.page) {
    const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',d); svg.append(path);
  }
  return svg;
}

export function button(label, name, onClick, className = '', title = label) {
  return el('button',{type:'button',class:className,title,'aria-label':label,onClick},name ? icon(name) : null,label ? el('span',{},label) : null);
}

export function iconButton(label, name, onClick, className = '') {
  return el('button',{type:'button',class:`icon-button ${className}`,title:label,'aria-label':label,onClick},icon(name));
}

export function svgEl(tag, attrs = {}) {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
  return node;
}
