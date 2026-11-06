(()=>{var p="openchamber.sdk",u=1;var Fe=`
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [data-oc-scrolling] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [data-oc-scrolling] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [data-oc-scrolling]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [data-oc-scrolling] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;function wt(e){let r=e.documentElement;if(r.hasAttribute("data-oc-scrollbar-activity"))return;r.setAttribute("data-oc-scrollbar-activity","");let i=new WeakMap;e.addEventListener("scroll",(h)=>{let _=h.target===e?r:h.target;if(!(_ instanceof Element))return;if(!_.hasAttribute("data-oc-scrolling"))_.setAttribute("data-oc-scrolling","");let k=i.get(_);if(k!==void 0)clearTimeout(k);i.set(_,setTimeout(()=>{i.delete(_),_.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var Io=`(${wt.toString()})(document);`;var Ve=128,$e=65536;var Se=128;var fe=65536;var Ht=/^[a-z][a-z0-9-]{0,39}$/;var Gt=(e)=>Object(e)===e&&!Array.isArray(e),Be=(e,r)=>Object.keys(e).every((i)=>r.includes(i)),Dt=(e)=>String(e)===e&&e.length>=1&&e.length<=60,Xt=(e)=>String(e)===e&&e.length>=1&&e.length<=80,Ft=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let r=new Set;for(let i of e){if(!Gt(i)||!Ht.test(i.id)||!Dt(i.label))return!1;if(i.disabled!==void 0&&i.disabled!==!0&&i.disabled!==!1)return!1;if(r.has(i.id))return!1;if(r.add(i.id),i.kind==="button"){if(!Be(i,["kind","id","label","disabled"]))return!1;continue}if(i.kind!=="select"||!Be(i,["kind","id","label","value","options","disabled"]))return!1;if(!Xt(i.value)||!Array.isArray(i.options)||i.options.length<1||i.options.length>16)return!1;let h=new Set;for(let _ of i.options){if(!Gt(_)||!Be(_,["value","label"])||!Xt(_.value)||!Dt(_.label)||h.has(_.value))return!1;h.add(_.value)}if(!h.has(i.value))return!1}return!0};var Vt=["{id}","{segment}","{segments+}"];var nr=new Set(Vt);var $t=["turn-finished","turn-failed","permission-asked","question-asked"];var ir=new Set($t);var Oe=20000000,Ae=256;var Ke=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,Bt=(e,r)=>{if(e.path!==r.path||e.readOnly!==r.readOnly)return!1;if(e.encoding==="text"||r.encoding==="text")return e.encoding==="text"&&r.encoding==="text"&&e.content===r.content;if(e.bytes.byteLength!==r.bytes.byteLength)return!1;for(let i=0;i<e.bytes.byteLength;i+=1)if(e.bytes[i]!==r.bytes[i])return!1;return!0};var Kt=/^[A-Za-z0-9_-]{1,80}$/;var jt=["left","right","top","bottom"];var zt=(e,r=0,i={remaining:16000})=>{if(--i.remaining<0||r>=32)return!1;if(e===null)return!0;let h=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let _ of h)if(!zt(_,r+1,i))return!1;return!0},je=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((r)=>/^(0|[1-9]\d*)$/.test(r)&&Number(r)<e.length)&&e.every(je);if(Object(e)===e){let r=Object.getPrototypeOf(e);return(r===null||r===Object.prototype)&&Object.values(e).every(je)}return String(e)===e||Number.isFinite(e)},ze=(e)=>{try{if(String(e.id)!==e.id||!Kt.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!jt.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!zt(e.data)||!je(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var Jt=["file","directory","other","missing"],Je=(e)=>Boolean(e&&"sessionId"in e),Ye=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var Yt=/^[0-9a-f]{7,64}$/i,Qe=(e)=>Yt.test(e),he=500,me=32000,Qt=16000,Zt=128,qt=200,eo=2000,to=16000,oo=80,ro=200,no=16000;var so=2000;var Ze=20000,Re=1024,xe=2000000;var be=64000,ge=8000,qe=4000;var et=960000;var io=999,ao=1e4,ae=500,co=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],lo=["stopped","starting","ready","failed"],yo=new Set(co),po=(e)=>yo.has(e),uo=(e)=>e&&po(e)?e:"HOST_REJECTED",J=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(J);if(Object(e)===e)return Object.values(e).every(J);return!1},_o=(e)=>J(e)&&JSON.stringify(e).length<=no,Wt=(e)=>e?.trim().slice(0,ro)??"",Y=(e)=>{let r=e.id.trim().slice(0,Zt),i=e.title.trim().slice(0,qt),h=e.url.trim().slice(0,eo),_=e.text?.trim().slice(0,to),k=e.author?.trim().slice(0,oo),X=e.kind==="pull"?"pull":"issue",v={providerId:e.providerId.trim(),id:r,title:i||r,url:h,kind:X};if(_)v.text=_;if(k)v.author=k;if(X==="pull"){let H=Wt(e.branches?.head),F=Wt(e.branches?.base);if(H&&F)v.branches={head:H,base:F}}if(_o(e.data))v.data=e.data;return v},tt=(e)=>{let r=Y(e);if(e.projectId)r.projectId=e.projectId;if(e.navigation)r.navigation=e.navigation;if(e.worktree)r.worktree=e.worktree;return r},ot=(e)=>{let r={text:e.text.trim().slice(0,Qt)};if(e.send)r.send=!0;return r},rt=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(io,Math.max(0,Math.round(e)))},nt=(e)=>{if(!Number.isFinite(e))return 0;return Math.min(ao,Math.max(0,Math.ceil(e)))};var Q=(e)=>e.length>0&&e.length<=Re&&!e.includes("\x00")&&!e.includes("\\");var ke=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>so)return!1;return!e.split("/").some((i)=>i==="."||i==="..")},Co=new Set(lo),st=(e)=>Boolean(e&&"status"in e&&Co.has(String(e.status))&&!("body"in e)),Ie=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),it=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),at=(e)=>Boolean(e&&"written"in e&&e.written===!0),ct=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),No=new Set(Jt),dt=(e)=>Boolean(e&&"kind"in e&&"size"in e&&No.has(String(e.kind))&&Number.isFinite(e.size)),lt=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),vo=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late"]),Mo=(e)=>Object(e)===e?e:null,We=(e)=>String(e)===e&&e.length>0,Lo=(e)=>{if(!We(e.id))return null;if(e.ok===!0){let r={channel:p,v:u,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)r.payload=e.payload;return r}if(e.ok===!1&&We(e.error))return{channel:p,v:u,type:"result",id:e.id,ok:!1,error:e.error,code:uo(We(e.code)?e.code:void 0)};return null},pt=(e)=>{let r=Mo(e);if(!r||r.channel!==p||r.v!==u)return null;if(r.type==="result")return Lo(r);if(!vo.has(String(r.type))||Object(r.payload)!==r.payload)return null;return r};var Eo=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),Po=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class a extends Error{code;constructor(e,r){super(r);this.name="HostRequestError",this.code=e}}var To=()=>Promise.reject(new a("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),Ue=()=>Promise.reject(new a("BAD_PATH",`File path must be 1 to ${Re} characters without NUL or backslash.`)),ye=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new a("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},l=(e)=>(e.value+=1,`oc-${e.value}`),ut=(e={})=>{let r=e.target??("window"in globalThis?window:null);if(!r)throw new a("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let i=e.acceptSource??((t)=>t===r.parent),h=e.requestTimeoutMs??Ze,_=new Set,k=new Set,X=new Set,v=new Set,H=new Set,F=new Set,ee=new Set,de=new Set,le=new Set,K=new Set,we=[],te=null,oe=null,pe=new Set,ue=new Set,re=null,ne=null,Ge=!1,j=new Map,z=new Map,W=new Map,L=!1,d={value:0},c=null,P=null,se=!1,ie=!1,bt=null,gt=(t)=>{if(!t)return null;return{sessionId:t.id,phase:t.busy?"started":"completed"}},C=(t)=>{r.parent.postMessage(t,"*")},kt=()=>{if(L||r.parent===r||K.size===0||c?.features?.lateGenerateResults!==!0)return;C({channel:p,v:u,type:"generate-late-listen"})},A=(t,o)=>{for(let n of t)try{n(o)}catch(s){console.error(s)}},It=(t)=>{if(!(t instanceof MessageEvent))return;if(!i(t.source))return;let o=pt(t.data);if(!o)return;if(o.type==="workspace"){let s=z.get(o.payload.subscriptionId);if(s)A([s],o.payload.snapshot);return}if(o.type==="shells"){let s=W.get(o.payload.subscriptionId);if(s)A([s],o.payload.snapshot);return}if(o.type==="ready"){if(c=o.payload,P=gt(o.payload.session),A(_,o.payload),A(k,o.payload.directory),A(X,o.payload.session),P)A(v,P);A(H,o.payload.connection),A(F,o.payload.settings),A(ee,o.payload.item),kt();return}if(o.type==="generate-late"){if(K.size===0)we.push(o.payload);else A(K,o.payload);return}if(o.type==="directory"){if(c)c={...c,directory:o.payload.directory};A(k,o.payload.directory);return}if(o.type==="session"){if(c)c={...c,session:o.payload.session};if(!o.payload.session)P=null;else if(P?.sessionId!==o.payload.session.id)P=gt(o.payload.session);A(X,o.payload.session);return}if(o.type==="session-lifecycle"){P=o.payload,A(v,o.payload);return}if(o.type==="connection"){if(c)c={...c,connection:o.payload.connection};A(H,o.payload.connection);return}if(o.type==="settings"){if(c)c={...c,settings:o.payload.settings};A(F,o.payload.settings);return}if(o.type==="item"){if(c)c={...c,item:o.payload.item};A(ee,o.payload.item);return}if(o.type==="status-control-event"){A(de,o.payload);return}if(o.type==="popover-closed"){A(le,o.payload);return}if(o.type==="action"){let s=(E)=>{if(!L)C({channel:p,v:u,type:"action-result",id:o.id,payload:E})},T=oe;if(!T){s({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>T(o.payload)).then(()=>s({ok:!0}),(E)=>{let x=(E instanceof Error?E.message:String(E)).trim();s({ok:!1,error:(x||"Action failed.").slice(0,ae)})});return}if(o.type==="file-open"){let s=o.payload;if(ne&&Bt(ne,s))return;ne=s,A(pe,o.payload);return}if(o.type==="file-saved"){A(ue,o.payload.version);return}if(o.type==="file-snapshot"){let s=(x)=>{if(!L)C({channel:p,v:u,type:"file-snapshot-result",id:o.id,payload:x})},T=(x)=>s({error:(x.trim()||"Could not read the edited file.").slice(0,ae)}),E=re;if(!E){T("This extension does not edit files.");return}Promise.resolve().then(()=>E(o.payload.purpose)).then((x)=>{if(Ke(x)>Oe){T(`The file is over ${Oe} ${"bytes"in x?"bytes":"characters"}.`);return}if(x.version.length>Ae){T(`The snapshot version is over ${Ae} characters.`);return}s({snapshot:"bytes"in x?{bytes:x.bytes,version:x.version}:{content:x.content,version:x.version}})},(x)=>T(x instanceof Error?x.message:String(x)));return}if(o.type==="resolve"){let s=(E)=>{C({channel:p,v:u,type:"resolve-result",id:o.id,payload:E})},T=te;if(!T){s({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>T(o.payload)).then((E)=>s({item:E?Y(E):null}),(E)=>{let x=(E instanceof Error?E.message:String(E)).trim();s({error:(x||"Command failed.").slice(0,ae)})});return}let n=j.get(o.id);if(!n)return;if(clearTimeout(n.timer),j.delete(o.id),o.ok){n.resolve(o.payload);return}n.reject(new a(o.code,o.error))};r.addEventListener("message",It),C({channel:p,v:u,type:"hello"});let b=(t,o=h)=>{if(L||r.parent===r)return Promise.reject(new a("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((n,s)=>{let T=setTimeout(()=>{j.delete(t.id),s(new a("HOST_TIMEOUT","Host did not answer in time."))},o);j.set(t.id,{resolve:n,reject:s,timer:T}),C(t)})},m=(t)=>b(t).then(()=>{return}),R={channel:p,v:u},De=(t)=>{if(!L&&r.parent!==r)C(t)},Ut=()=>De({...R,type:"file-save"}),yt=(t)=>{if(!Eo(t)||!Po(t))return;t.preventDefault(),Ut()},Ct=(t)=>{if(!Eo(t)||t.key!=="Escape"||c?.surface!=="popover"||!c.popover)return;t.preventDefault(),Lt(c.popover.id,"escape").catch(()=>{return})},_e=()=>{let t=c?.surface==="popover"?c.popover:void 0;if(!t)return;let o=se||ie;if(bt===o)return;bt=o,Pt(t.id,o).catch(()=>{return})},Ee=()=>{if(c?.surface!=="popover"||se)return;se=!0,_e()},Nt=(t)=>{if(c?.surface!=="popover"||t.relatedTarget!==null||!se)return;se=!1,_e()},vt=()=>{if(c?.surface!=="popover"||ie)return;ie=!0,_e()},Mt=()=>{if(c?.surface!=="popover"||!ie)return;ie=!1,_e()},M=(t,o=1024)=>{if(!t.trim()||t.length>o)throw new a("HOST_REJECTED",`Identity must contain 1 to ${o} characters.`)},Xe=async(t)=>{if(t.kind!=="projects")M(t.projectId);let o=await b({...R,type:"workspace-read",id:l(d),payload:t});if(!o||!("kind"in o)||!("state"in o)||o.kind!==t.kind)throw new a("HOST_REJECTED","Host did not return workspace data.");return o},He=async(t,o)=>{if(t.kind!=="projects")M(t.projectId);let n=l(d);z.set(n,o);try{await m({...R,type:"workspace-subscribe",id:l(d),payload:{subscriptionId:n,query:t}})}catch(s){if(z.delete(n),!L)C({...R,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:n}});throw s}return()=>{if(!z.delete(n)||L)return;C({...R,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:n}})}},ko=async(t,o)=>{if(t.kind==="session")M(t.sessionId);if(t.kind==="project")M(t.projectId);let n=l(d);W.set(n,o);try{await m({...R,type:"shells-subscribe",id:l(d),payload:{subscriptionId:n,scope:t}})}catch(s){if(W.delete(n),!L)C({...R,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:n}});throw s}return()=>{if(!W.delete(n)||L)return;C({...R,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:n}})}},Te=async(t)=>{if("key"in t&&(t.key.length===0||t.key.length>Ve))throw new a("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!J(t.value))throw new a("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>$e)throw new a("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&c?.features?.deviceStorage!==!0)throw new a("UNSUPPORTED","This host does not support device storage.");let o=await b({...R,type:"storage",id:l(d),payload:t});if(!o||!("storage"in o)||o.op!==t.op)throw new a("HOST_REJECTED","Host did not return storage data.");return o},Lt=(t,o)=>c?.features?.popovers!==!0&&!(c?.surface==="popover"&&c.popover?.id===t)?Promise.reject(new a("UNSUPPORTED","This host does not support popovers.")):m({...R,type:"popover-close",id:l(d),payload:o?{id:t,reason:o}:{id:t}}),Pt=(t,o)=>c?.features?.popovers!==!0&&!(c?.surface==="popover"&&c.popover?.id===t)?Promise.reject(new a("UNSUPPORTED","This host does not support popovers.")):m({...R,type:"popover-anchor",id:l(d),payload:{id:t,active:o}});return r.addEventListener("keydown",Ct,!0),r.addEventListener("pointerover",Ee),r.addEventListener("pointermove",Ee),r.addEventListener("pointerout",Nt),r.addEventListener("focus",vt),r.addEventListener("blur",Mt),{onAction:(t)=>(oe=t,()=>{if(oe===t)oe=null}),listProjects:async()=>{let t=await Xe({kind:"projects"});if(t.kind!=="projects")throw new a("HOST_REJECTED","Expected projects.");return t},listWorktrees:async(t)=>{let o=await Xe({kind:"worktrees",projectId:t});if(o.kind!=="worktrees")throw new a("HOST_REJECTED","Expected worktrees.");return o},listSessions:async(t)=>{let o=await Xe({kind:"sessions",projectId:t});if(o.kind!=="sessions")throw new a("HOST_REJECTED","Expected sessions.");return o},onProjects:(t)=>He({kind:"projects"},(o)=>{if(o.kind==="projects")t(o)}),onWorktrees:(t,o)=>He({kind:"worktrees",projectId:t},(n)=>{if(n.kind==="worktrees")o(n)}),onSessions:(t,o)=>He({kind:"sessions",projectId:t},(n)=>{if(n.kind==="sessions")o(n)}),onRunningShells:(t,o)=>ko(t,o),readShellOutput:async(t,o)=>{M(t,Se);let n=o?.cursor;if(n!==void 0&&(!Number.isInteger(n)||n<0))throw new a("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let s=o?.tailBytes;if(s!==void 0&&(!Number.isInteger(s)||s<1||s>fe))throw new a("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${fe}.`);let E=await b({...R,type:"shell-output",id:l(d),payload:{shellId:t,cursor:n,tailBytes:s}});if(!E||typeof E.output!=="string"||!Number.isFinite(E.cursor))throw new a("HOST_REJECTED","Host did not return shell output.");return E},stopShell:async(t)=>{if(M(t,Se),(await b({...R,type:"shell-stop",id:l(d),payload:{shellId:t}}))?.stopped!==!0)throw new a("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(t)=>{M(t),await m({...R,type:"open-session",id:l(d),payload:{sessionId:t}})},storage:{get:async(t,o)=>{let n=ye(o),s={op:"get",key:t};if(n)s.scope=n;let T=await Te(s);return T.op==="get"&&T.found?T.value:void 0},set:async(t,o,n)=>{let s=ye(n),T={op:"set",key:t,value:o};if(s)T.scope=s;await Te(T)},delete:async(t,o)=>{let n=ye(o),s={op:"delete",key:t};if(n)s.scope=n;await Te(s)},keys:async(t)=>{let o=ye(t),n={op:"keys"};if(o)n.scope=o;let s=await Te(n);if(s.op!=="keys")throw new a("HOST_REJECTED","Expected storage keys.");return s.keys}},onReady:(t)=>{if(_.add(t),c)t(c);return()=>{_.delete(t)}},onDirectory:(t)=>{if(k.add(t),c)t(c.directory);return()=>{k.delete(t)}},onSession:(t)=>{if(X.add(t),c)t(c.session);return()=>{X.delete(t)}},onSessionLifecycle:(t)=>{if(v.add(t),P)t(P);return()=>{v.delete(t)}},onConnection:(t)=>{if(H.add(t),c)t(c.connection);return()=>{H.delete(t)}},onSettings:(t)=>{if(F.add(t),c)t(c.settings);return()=>{F.delete(t)}},onItem:(t)=>{if(ee.add(t),c)t(c.item);return()=>{ee.delete(t)}},onStatusControl:(t)=>(de.add(t),()=>{de.delete(t)}),onPopoverClosed:(t)=>(le.add(t),()=>{le.delete(t)}),setStatusControls:(t)=>{if(c?.features?.statusControls!==!0)return Promise.reject(new a("UNSUPPORTED","This host does not support status controls."));if(!Ft(t))return Promise.reject(new a("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return m({...R,type:"status-controls",id:l(d),payload:{controls:t}})},openPopover:(t)=>{if(c?.features?.popovers!==!0)return Promise.reject(new a("UNSUPPORTED","This host does not support popovers."));if(!ze(t))return Promise.reject(new a("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return m({...R,type:"popover-open",id:l(d),payload:t})},closePopover:Lt,setPopoverAnchorActive:Pt,onResolve:(t)=>(te=t,()=>{if(te===t)te=null}),toast:(t)=>{let o=t.message.trim();if(!o||o.length>he)return Promise.reject(new a("HOST_REJECTED",`Toast message must contain 1 to ${he} characters.`));if(t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>me))return Promise.reject(new a("HOST_REJECTED",`Toast copy text must contain 1 to ${me} characters.`));return m({channel:p,v:u,type:"toast",id:l(d),payload:{...t,message:o}})},openUrl:(t)=>m({channel:p,v:u,type:"open-url",id:l(d),payload:{url:t}}),openCommit:(t)=>Qe(t)?m({channel:p,v:u,type:"open-commit",id:l(d),payload:{sha:t}}):Promise.reject(new a("HOST_REJECTED","Commit id must be 7 to 64 hex characters.")),openSurface:(t)=>m({channel:p,v:u,type:"open-surface",id:l(d),payload:{surfaceId:t}}),writeClipboard:(t)=>m({channel:p,v:u,type:"clipboard-write",id:l(d),payload:{text:t}}),compose:(t)=>m({channel:p,v:u,type:"compose",id:l(d),payload:t}),attach:(t)=>m({channel:p,v:u,type:"attach",id:l(d),payload:Y(t)}),startSession:async(t)=>{if(t.projectId!==void 0)M(t.projectId);let o=t.worktree;if(o&&o!==!0)if(o.kind==="existing")M(o.directory);else{if(o.name!==void 0)M(o.name,200);if(o.baseBranch!==void 0)M(o.baseBranch,200)}let n=await b({channel:p,v:u,type:"start-session",id:l(d),payload:tt(t)},e.requestTimeoutMs??180000);if(!Je(n))throw new a("HOST_REJECTED","Host did not return a session.");return n},prompt:(t)=>b({channel:p,v:u,type:"prompt",id:l(d),payload:ot(t)}).then((o)=>{if(!Ye(o))throw new a("HOST_REJECTED","Host did not return a prompt result.");return o}),sessionLink:(t)=>m({channel:p,v:u,type:"session-link",id:l(d),payload:Y(t)}),close:()=>m({channel:p,v:u,type:"close",id:l(d)}),oauthStart:()=>m({channel:p,v:u,type:"oauth-start",id:l(d)}),oauthDisconnect:()=>m({channel:p,v:u,type:"oauth-disconnect",id:l(d)}),request:(t)=>(ke(t.path)?b({channel:p,v:u,type:"request",id:l(d),payload:t}):To()).then((o)=>{if(!Ie(o))throw new a("HOST_REJECTED","Host request result was empty.");return o}),serviceRequest:(t)=>(ke(t.path)?b({channel:p,v:u,type:"service-request",id:l(d),payload:t}):To()).then((o)=>{if(!Ie(o))throw new a("HOST_REJECTED","Host service request result was empty.");return o}),serviceStatus:()=>b({channel:p,v:u,type:"service-status",id:l(d)}).then((t)=>{if(!st(t))throw new a("HOST_REJECTED","Host did not return service status.");return t}),readFile:(t)=>(Q(t)?b({channel:p,v:u,type:"file-read",id:l(d),payload:{path:t}}):Ue()).then((o)=>{if(!it(o))throw new a("HOST_REJECTED","Host did not return file content.");return o}),writeFile:(t,o)=>{if(!Q(t))return Ue();if(o.length>xe)return Promise.reject(new a("FILE_TOO_LARGE",`Content is over ${xe} characters.`));return b({channel:p,v:u,type:"file-write",id:l(d),payload:{path:t,content:o}}).then((n)=>{if(!at(n))throw new a("HOST_REJECTED","Host did not confirm the write.");return n})},listDir:(t)=>(Q(t)?b({channel:p,v:u,type:"file-list",id:l(d),payload:{path:t}}):Ue()).then((o)=>{if(!ct(o))throw new a("HOST_REJECTED","Host did not return directory entries.");return o}),stat:(t)=>(Q(t)?b({channel:p,v:u,type:"file-stat",id:l(d),payload:{path:t}}):Ue()).then((o)=>{if(!dt(o))throw new a("HOST_REJECTED","Host did not return file status.");return o}),generate:(t)=>{let o=t.prompt.trim(),n=t.system?.trim();if(o.length===0||o.length>be)return Promise.reject(new a("HOST_REJECTED",`Prompt must be 1 to ${be} characters.`));if(n!==void 0&&(n.length===0||n.length>ge))return Promise.reject(new a("HOST_REJECTED",`System prompt must be 1 to ${ge} characters.`));let s=t.maxOutputTokens===void 0?void 0:Math.min(qe,Math.max(1,Math.floor(t.maxOutputTokens)));if(s!==void 0&&!Number.isFinite(s))return Promise.reject(new a("HOST_REJECTED","maxOutputTokens must be a number."));let T={prompt:o};if(n!==void 0)T.system=n;if(s!==void 0)T.maxOutputTokens=s;return b({channel:p,v:u,type:"generate",id:l(d),payload:T},e.requestTimeoutMs??et).then((E)=>{if(!lt(E))throw new a("HOST_REJECTED","Host did not return generated text.");return E})},onLateGenerateResult:(t)=>{K.add(t);for(let o of we.splice(0))A([t],o);return kt(),()=>{K.delete(t)}},setBadge:(t)=>m({channel:p,v:u,type:"badge",id:l(d),payload:{count:rt(t)}}),setHeight:(t)=>m({channel:p,v:u,type:"resize",id:l(d),payload:{height:nt(t)}}),onFileOpen:(t)=>{if(pe.add(t),!Ge)Ge=!0,r.addEventListener("keydown",yt,!0);if(ne)t(ne);return()=>{pe.delete(t)}},onFileSnapshot:(t)=>(re=t,()=>{if(re===t)re=null}),onFileSaved:(t)=>(ue.add(t),()=>{ue.delete(t)}),reportFileChange:(t)=>De({...R,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:Ut,reportFileUnsupported:()=>De({...R,type:"file-unsupported"}),dispose:()=>{for(let t of z.keys())C({...R,type:"workspace-unsubscribe",id:l(d),payload:{subscriptionId:t}});z.clear();for(let t of W.keys())C({...R,type:"shells-unsubscribe",id:l(d),payload:{subscriptionId:t}});if(W.clear(),L=!0,te=null,oe=null,re=null,pe.clear(),ue.clear(),Ge)r.removeEventListener("keydown",yt,!0);r.removeEventListener("message",It),r.removeEventListener("keydown",Ct,!0),r.removeEventListener("pointerover",Ee),r.removeEventListener("pointermove",Ee),r.removeEventListener("pointerout",Nt),r.removeEventListener("focus",vt),r.removeEventListener("blur",Mt);for(let t of j.values())clearTimeout(t.timer),t.reject(new a("HOST_UNAVAILABLE","Host client was disposed."));j.clear(),_.clear(),k.clear(),X.clear(),v.clear(),H.clear(),F.clear(),ee.clear(),de.clear(),le.clear(),K.clear(),we.length=0}}};var So=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var hr=new Set(So);var fo=["none","agent","user"];var Rr=new Set(fo);var wo=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],Go=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],Oo=(e,r)=>{r.style.colorScheme=e.mode;for(let[i,h]of wo)r.style.setProperty(i,e.tokens[h]);for(let[i,h,_]of Go){let k=e.tokens[_]??"";r.style.setProperty(i,k),r.style.setProperty(h,k)}r.style.setProperty("font-family",e.tokens.font),r.style.setProperty("font-size","0.875rem"),r.style.setProperty("line-height","1.45"),r.style.setProperty("color",e.tokens.foreground)},_t=(e,r)=>{if(Oo(e.theme,r),r.dataset)r.dataset.ocSurface=e.surface,r.dataset.ocTheme=e.theme.mode};var Do={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},S=(e,r)=>`var(--${e}, var(--oc-${Do[e]}, ${r}))`,G=S("surface-background","transparent"),Ne=S("surface-elevated","transparent"),Z=S("surface-elevated-foreground","inherit"),N=S("surface-foreground","inherit"),f=S("surface-muted-foreground","gray"),Xo=S("surface-muted","transparent"),V=S("interactive-border","currentColor"),I=S("interactive-hover","transparent"),B=S("interactive-active","transparent"),Et=S("interactive-selection","transparent"),Tt=S("interactive-selection-foreground","inherit"),w=S("primary","currentColor"),St=S("primary-text","inherit"),ft=S("error-text","inherit"),Ho=S("font-sans","inherit"),Ot=S("font-mono","monospace"),Ro=S("radius","9px"),At=`calc(${Ro} - 2px)`,Ao=`calc(${Ro} - 4px)`,O=(e,r,i="transparent")=>`color-mix(in srgb, ${e} ${r}%, ${i})`,ho=`background-image: linear-gradient(${I}, ${I});`,ht=(e,r="0.5px")=>`box-shadow: inset 0 0 0 ${r} ${e}, var(--oc-sdk-field-lift);`,mt="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",mo="box-shadow: var(--oc-sdk-lit);",Rt=`inset 0 0.5px 0 0 ${O(N,8)}, 0 1px 2px 0 rgb(0 0 0 / 0.4)`,Fo=`
:root {
  --oc-sdk-edge: ${O(N,16)};
  --oc-sdk-field-bg: ${Ne};
  --oc-sdk-raised-bg: ${G};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 1.5px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 1px 1.5px 0 rgb(0 0 0 / 0.1);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.14);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.7), 0 1px 2px -0.5px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.06);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${O(N,14)};
  --oc-sdk-field-bg: ${O(G,50,Ne)};
  --oc-sdk-raised-bg: ${Ne};
  --oc-sdk-field-lift: ${Rt};
  --oc-sdk-raised-lift: ${Rt};
  --oc-sdk-lit: ${Rt};
  --oc-sdk-float-edge: rgb(0 0 0 / 0.55);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.04), inset 0 0 0 0.5px rgb(255 255 255 / 0.08), 0 8px 16px 0 rgb(0 0 0 / 0.25), 0 4px 8px 0 rgb(0 0 0 / 0.25);
}`,Ce=(e)=>{let r=S(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${r}; --oc-sdk-tone-text: ${S(`${e}-text`,"inherit")}; }`},Vo=`
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 32px; padding: 0 12px; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: 6px; height: 28px; padding: 0 10px; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: 4px; height: 24px; padding: 0 8px; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: 14px; height: 14px; }

.oc-sdk-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: 32px; padding: 0 10px; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: 8px 10px; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: 34px; padding-right: 34px; }
.oc-sdk-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: 24px; height: 24px; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; width: auto; max-width: 100%; min-width: 0; height: 28px; padding: 0 10px; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: 2px; min-width: 160px; max-width: calc(100vw - 16px); max-height: min(320px, calc(100vh - 16px)); overflow: auto; padding: 4px; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: 2px 2px 4px; }
.oc-sdk-popup-search .oc-sdk-input { height: 28px; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: 14px; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: 8px; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: 8px; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-top: 3px; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: 36px; height: 20px; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: 2px; padding: 2px; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: 1px 6px; font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: 16px 8px; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 40px 16px; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: 12px; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: 16px; height: 16px; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: 12px; height: 12px; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: 12px; padding: 8px 12px; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: 8px; width: 100%; margin: 8px 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: 4px 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: 6px; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }
.oc-sdk-progress-value { display: inline-flex; align-items: center; gap: 2px; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { font-weight: 600; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: 8px 0; }
`,xo=`${Fo}
.oc-sdk { color: ${N}; font-family: ${Ho}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${ho} }
.oc-sdk-mono { font-family: ${Ot}; }
.oc-sdk-muted { color: ${f}; }
${Ce("success")}${Ce("warning")}${Ce("error")}${Ce("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${w}; --oc-sdk-tone-text: ${St}; }

.oc-sdk-btn { border-radius: ${At}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${Ao}; }
.oc-sdk-btn[data-variant="default"] { color: ${St}; background: ${O(w,10,G)}; border-color: ${O(w,12)}; ${mo} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${O(w,16,G)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${O(w,22,G)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${Xo}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${I}, ${I}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${B}, ${B}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${Z}; ${mt} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${I}, ${I}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${B}, ${B}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${I}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${B}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${S("status-error","red")}; color: ${ft}; background: ${O("var(--oc-sdk-tone)",7,G)}; border-color: ${O("var(--oc-sdk-tone)",12)}; ${mo} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${O("var(--oc-sdk-tone)",9,G)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${O("var(--oc-sdk-tone)",11,G)}; box-shadow: none; }

.oc-sdk-field-note { color: ${f}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${ft}; }
.oc-sdk-input { border-radius: ${At}; background: var(--oc-sdk-field-bg); color: ${Z}; ${ht("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${f}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${I}, ${I}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${ht(O(N,26),"1px")} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${ht(S("status-error","red"),"1px")} }
.oc-sdk-input[data-mono="true"] { font-family: ${Ot}; }

.oc-sdk-search-icon { color: ${f}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${w}; }
.oc-sdk-search-clear { border-radius: ${Ao}; color: ${f}; }
.oc-sdk-search-clear:hover { background: ${I}; color: ${N}; }

.oc-sdk-trigger { border-radius: ${At}; background: var(--oc-sdk-raised-bg); color: ${Z}; ${mt} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${I}, ${I}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${B}, ${B}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${f}; }
.oc-sdk-trigger-chevron { color: ${f}; }
/* The app's floating level: the glass edge (a hairline ring and a lit top line, dark outside and light inside in dark themes) over soft shadows. The outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${Z}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${Ne}; background-clip: padding-box; color: ${Z}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${I}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${Et}; color: ${Tt}; }
.oc-sdk-option-check { color: ${N}; }
.oc-sdk-option[data-destructive="true"] { color: ${ft}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${O(S("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${f}; }
.oc-sdk-popup-empty { color: ${f}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${V}; border-radius: 4px; color: ${N}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${O(N,60,V)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${V}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${G}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${w}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(16px); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${ho} }
.oc-sdk-check-desc { color: ${f}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${O(N,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${f}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${N}; }
.oc-sdk-tab[aria-selected="true"] { color: ${Tt}; background: ${Et}; border-color: ${V}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${Z}; background: var(--oc-sdk-raised-bg); ${mt} }
.oc-sdk-tab-count { color: ${f}; }

/* The app's neutral badge: a step of the text colour, the same in every theme. */
.oc-sdk-badge { border-radius: 9999px; background: ${O(N,6)}; color: ${f}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${O("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${I}; }
.oc-sdk-row[aria-selected="true"] { background: ${Et}; color: ${Tt}; }
.oc-sdk-row-lead { font-family: ${Ot}; color: ${f}; }
.oc-sdk-row-sub { color: ${f}; }
.oc-sdk-row-meta { color: ${f}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${f}; }

.oc-sdk-empty-body { color: ${f}; }

.oc-sdk-spinner { color: ${f}; }
.oc-sdk-spinner-ring { border-color: ${V}; border-top-color: ${w}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${O("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${f}; }

.oc-sdk-separator { color: ${f}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${O(V,40)}; }

.oc-sdk-progress-label { color: ${f}; }
/* The app's progress: a groove a step of the text colour, green once done. Older bundles mark done only through aria-valuenow. */
.oc-sdk-progress-track { border-radius: 9999px; background: ${O(N,6)}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${w}); }
.oc-sdk-progress-track[aria-valuenow="100"] > .oc-sdk-progress-fill:not([data-tone]) { background: ${S("status-success","currentColor")}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { color: ${S("success-text","inherit")}; }

.oc-sdk-text a { color: ${St}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${O(V,60)}; }
`,g=`
${Fe}
${Vo}
${xo}`;var zo=ut(),go=document.querySelector("#root");if(!go)throw Error("panel root element is missing");var bo=!1,Wo=()=>{let e=document.createElement("header");e.className="header";let r=document.createElement("h1");r.textContent="YouTrack";let i=document.createElement("span");i.className="pill",i.textContent="v0.1.0",e.append(r,i);let h=document.createElement("p");h.className="lede",h.textContent="Hello from the OpenChamber YouTrack extension.",go.replaceChildren(e,h)};zo.onReady((e)=>{if(_t(e,document.documentElement),bo)return;bo=!0,Wo()});})();
