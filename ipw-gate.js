/* ipowork secure sign-in gate (Supabase). Uses the same accounts as the Debt Board.
 *
 * Automatic gate for a whole page (one tag in <head>; this file loads the Supabase library itself):
 *   <script src="ipw-gate.js" data-roles="admin" data-title="Bulk Debt Intelligence Engine"></script>
 * data-roles: comma-separated roles allowed in (admin, merchant_banker, institution, fund_manager, issuer, ca_cs).
 * Admin is always allowed.
 *
 * Manual use (for pages with their own login modal): IPWGate.signIn(email, password, roles) → {ok, profile, error}
 * IPWGate.getClient() → Promise of the Supabase client.
 */
(function(){
  var SUPABASE_URL='https://esqlfsjhekdspycfgnoz.supabase.co';
  var SUPABASE_KEY='sb_publishable_CFdw2j0-mD4VeF9kQdyhdg_ZDPxQW9a';
  var ROLE_LABEL={institution:'Institution',merchant_banker:'Merchant banker',fund_manager:'Fund house',issuer:'Issuer',ca_cs:'CA / CS partner',admin:'Admin'};
  var me=document.currentScript;
  var G=window.IPWGate={client:null,session:null,profile:null,ok:false};
  try{ localStorage.removeItem('_adm'); sessionStorage.removeItem('_adm'); }catch(e){}

  var LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js';
  G.ready=new Promise(function(done){
    if(window.supabase) return done();
    var s=document.createElement('script'); s.src=LIB; s.onload=done; s.onerror=done;
    (document.head||document.documentElement).appendChild(s);
  });
  async function client(){
    await G.ready;
    if(G.client) return G.client;
    if(!window.supabase) return null;
    G.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true}});
    return G.client;
  }
  G.getClient=client;
  function allowed(p,roles){ return !!p&&p.status==='approved'&&(p.role==='admin'||roles.indexOf(p.role)>=0); }
  async function profileFor(user){
    var r=await (await client()).from('db_profiles').select('*').eq('id',user.id).maybeSingle();
    return r.data||null;
  }
  function why(p,roles){
    if(!p) return 'This account has no ipowork profile yet. Create one on the Debt Board first.';
    if(p.status==='pending') return 'Your account is still being verified. You will get an email when access opens.';
    if(p.status==='rejected') return 'This account could not be verified. Contact ipowork.';
    return 'This page is for '+roles.map(function(r){return ROLE_LABEL[r]||r;}).join(' or ').toLowerCase()+' accounts. You are signed in as '+(ROLE_LABEL[p.role]||p.role).toLowerCase()+'.';
  }
  G.check=async function(roles){
    var c=await client(); if(!c) return {ok:false,error:'Sign-in service did not load. Check your connection and refresh.'};
    var s=(await c.auth.getSession()).data.session;
    if(!s) return {ok:false};
    var p=await profileFor(s.user);
    G.session=s; G.profile=p; G.ok=allowed(p,roles);
    return G.ok?{ok:true,profile:p}:{ok:false,profile:p,error:why(p,roles)};
  };
  G.signIn=async function(email,password,roles){
    var c=await client(); if(!c) return {ok:false,error:'Sign-in service did not load. Check your connection and refresh.'};
    var r=await c.auth.signInWithPassword({email:email,password:password});
    if(r.error) return {ok:false,error:/invalid login/i.test(r.error.message)?'That email and password do not match an account.':/confirm/i.test(r.error.message)?'Confirm your email first. The link is in your inbox.':r.error.message};
    var p=await profileFor(r.data.user);
    G.session=r.data.session; G.profile=p; G.ok=allowed(p,roles);
    if(!G.ok){ await c.auth.signOut(); return {ok:false,profile:p,error:why(p,roles)}; }
    return {ok:true,profile:p};
  };
  G.signOut=async function(){ var c=await client(); if(c) await c.auth.signOut(); G.ok=false; G.profile=null; try{ localStorage.removeItem('ipowork_user'); localStorage.removeItem('user'); }catch(e){} };
  G.token=function(){ return G.session?G.session.access_token:null; };
  /* restore the session on load so Worker calls are authenticated straight away */
  (async function(){ try{ var c=await client(); if(!c) return; var s=(await c.auth.getSession()).data.session; if(s) G.session=s; }catch(e){} })();

  /* ── attach the ipowork session to Cloudflare Worker calls ──
     The Worker now refuses expensive work from anonymous callers, so every
     request from a signed-in user carries their access token automatically. */
  var WORKER_HOSTS=['workers.dev','api.ipowork.com'];
  (function(){
    if(window.__ipwFetchPatched) return; window.__ipwFetchPatched=true;
    var orig=window.fetch;
    window.fetch=function(input,init){
      try{
        var url=typeof input==='string'?input:(input&&input.url)||'';
        var isWorker=WORKER_HOSTS.some(function(h){ return url.indexOf(h)>=0; });
        if(isWorker&&G.session&&G.session.access_token){
          init=init||{};
          var h=new Headers((init.headers)||(typeof input!=='string'&&input.headers)||{});
          if(!h.has('Authorization')) h.set('Authorization','Bearer '+G.session.access_token);
          init.headers=h;
          if(typeof input!=='string') return orig(new Request(input,{headers:h}),init);
        }
      }catch(e){}
      return orig(input,init);
    };
  })();

  /* ── automatic full-page gate ── */
  var rolesAttr=me&&me.getAttribute('data-roles');
  if(!rolesAttr) return;
  var roles=rolesAttr.split(',').map(function(s){return s.trim();}).filter(Boolean);
  var title=(me.getAttribute('data-title')||'ipowork');
  var css='#ipw-gate{position:fixed;inset:0;z-index:2147483647;background:#08404D;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Sora,system-ui,sans-serif}'
   +'#ipw-gate .bx{background:#fff;border-radius:16px;padding:30px;width:100%;max-width:370px;box-shadow:0 24px 64px rgba(0,0,0,.5);color:#1A2E35}'
   +'#ipw-gate h1{font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:800;color:#08404D;text-align:center;margin:0}'
   +'#ipw-gate h1 sup{font-size:10px;color:#E88A2E}#ipw-gate .t{text-align:center;font-weight:700;margin:10px 0 2px;font-size:14px}'
   +'#ipw-gate .s{text-align:center;font-size:12px;color:#5E7C86;margin-bottom:18px}'
   +'#ipw-gate label{display:block;font-size:11px;font-weight:700;color:#5E7C86;margin:0 0 4px}'
   +'#ipw-gate input{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #D0E4F0;border-radius:8px;font-size:15px;margin-bottom:12px;outline:none;font-family:inherit}'
   +'#ipw-gate input:focus{border-color:#1A7D90}#ipw-gate button{width:100%;padding:13px;background:#08404D;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}'
   +'#ipw-gate button[disabled]{opacity:.6}#ipw-gate .er{color:#C0392B;font-size:12.5px;margin-bottom:10px;min-height:0}'
   +'#ipw-gate .ft{display:flex;justify-content:space-between;margin-top:14px;font-size:12px}#ipw-gate a{color:#0D5C6B}'
   +'html.ipw-locked body>*:not(#ipw-gate){visibility:hidden!important}'
   +'#ipw-out{position:fixed;right:14px;bottom:14px;z-index:2147483646;background:#08404D;color:#fff;border:none;border-radius:99px;padding:8px 14px;font:600 12px Sora,system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  document.documentElement.style.overflow='hidden'; document.documentElement.classList.add('ipw-locked');
  function mount(){
    if(document.getElementById('ipw-gate')) return;
    var d=document.createElement('div'); d.id='ipw-gate'; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    d.innerHTML='<div class="bx"><h1>ipowork<sup>AI</sup></h1><div class="t"></div><div class="s">Sign in with your ipowork account</div>'
      +'<div class="er" id="ipw-er" role="alert"></div>'
      +'<label for="ipw-e">Email</label><input id="ipw-e" type="email" autocomplete="email"/>'
      +'<label for="ipw-p">Password</label><input id="ipw-p" type="password" autocomplete="current-password"/>'
      +'<button id="ipw-go">Sign in</button>'
      +'<div class="ft"><a href="debt-board.html">Forgot password?</a><a href="index.html">Back to homepage</a></div></div>';
    d.querySelector('.t').textContent=title;
    document.body.appendChild(d);
    var go=async function(){
      var b=document.getElementById('ipw-go'), er=document.getElementById('ipw-er');
      var e=document.getElementById('ipw-e').value.trim(), p=document.getElementById('ipw-p').value;
      if(!e||!p){ er.textContent='Enter your email and password.'; return; }
      b.disabled=true; b.textContent='Signing in';
      var r=await G.signIn(e,p,roles);
      b.disabled=false; b.textContent='Sign in';
      if(r.ok) unlock(); else { er.textContent=r.error; document.getElementById('ipw-p').value=''; }
    };
    document.getElementById('ipw-go').onclick=go;
    document.getElementById('ipw-p').onkeydown=function(e){ if(e.key==='Enter') go(); };
    document.getElementById('ipw-e').onkeydown=function(e){ if(e.key==='Enter') document.getElementById('ipw-p').focus(); };
    setTimeout(function(){ var i=document.getElementById('ipw-e'); if(i) i.focus(); },50);
  }
  function unlock(){
    var g=document.getElementById('ipw-gate'); if(g) g.remove();
    document.documentElement.style.overflow=''; document.documentElement.classList.remove('ipw-locked');
    if(!document.getElementById('ipw-out')){
      var o=document.createElement('button'); o.id='ipw-out';
      o.textContent='Sign out'+(G.profile&&G.profile.full_name?' ('+G.profile.full_name+')':'');
      o.onclick=async function(){ await G.signOut(); location.reload(); };
      document.body.appendChild(o);
    }
    document.dispatchEvent(new CustomEvent('ipw:unlocked',{detail:G.profile}));
  }
  function start(){
    mount();
    G.check(roles).then(function(r){
      if(r.ok) return unlock();
      if(r.error){ var er=document.getElementById('ipw-er'); if(er) er.textContent=r.error; }
    });
  }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded',start);
})();
