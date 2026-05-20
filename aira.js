
console.log('ipowork v3.1 loaded - switchTier:', typeof switchTier);
var AIRA_RESULTS={};
var ADMIN_UNLOCKED = false;
var CURRENT_USER = null;
var ADMIN_PWD = 'ipowork@admin';
var ADMIN_EMAIL = 'jiweshkshrivastava@gmail.com';



function handleAdminClick(){
  try {
    var cu=window.CURRENT_USER;
    var isAdmin=window.ADMIN_UNLOCKED||(cu&&(cu.plan==='admin'||cu.email===ADMIN_EMAIL));
    if(isAdmin){
      var t=document.getElementById('tab-admin');
      if(t){t.style.display='';t.style.opacity='1';}
      switchTier('admin');
    } else {
      openAdminAuth();
    }
  } catch(e){ openAdminAuth(); }
}



function saveReportToStore(tier, cname, sector, result){
  try {
    updateFullReportBtn();
    var store = JSON.parse(localStorage.getItem('aira_report_log')||'[]');
    store.unshift({
      tier: tier,
      cname: cname,
      company: cname,
      sector: sector,
      ts: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      result: result ? {company_name: result.company_name||cname, ipo_score: result.ipo_score||0} : {},
      user: CURRENT_USER ? CURRENT_USER.email : 'unknown'
    });
    if(store.length > 50) store = store.slice(0,50); // keep last 50
    localStorage.setItem('aira_report_log', JSON.stringify(store));
  } catch(e){}
}

function getStoredReports(){
  try { return JSON.parse(localStorage.getItem('aira_report_log')||'[]'); } catch(e){ return []; }
}


function clearReportHistory(){
  if(confirm('Clear all report history?')){
    localStorage.removeItem('aira_report_log');
    loadAdmin();
  }
}

function getPendingRequests(){
  try {
    return JSON.parse(localStorage.getItem('aira_access_requests')||'[]');
  } catch(e){ return []; }
}

function loadPendingRequests(){
  var el = document.getElementById('access-requests-list');
  if(!el) return;
  var reqs = getPendingRequests();
  if(reqs.length === 0){
    el.innerHTML = '<div style="padding:16px;font-size:12px;color:#9AB0B8;text-align:center">No pending requests</div>';
    return;
  }
  var html = '';
  reqs.forEach(function(r, idx){
    html += '<div style="padding:12px 16px;border-bottom:1px solid #F0F0F0;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:#1A2E35">'+esc(r.name||'')+'</div>'
      +'<div style="font-size:11px;color:#6B8A94">'+esc(r.email||'')+' · '+esc(r.phone||'')+' · '+esc(r.org||'')+' · '+esc(r.purpose||'')+'</div>'
      +'<div style="font-size:10px;color:#9AB0B8;margin-top:2px">'+new Date(r.ts||Date.now()).toLocaleString('en-IN')+'</div></div>'
      +'<button onclick="approveRequest('+idx+')" style="padding:5px 12px;background:#1A6B3A;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Approve</button>'
      +'<button onclick="rejectRequest('+idx+')" style="padding:5px 12px;background:#C0392B;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer">Reject</button>'
      +'</div>';
  });
  el.innerHTML = html;
}

function loadApprovedUsers(){
  var el = document.getElementById('approved-users-list');
  if(!el) return;
  var users = Object.keys(IPOWORK_USERS);
  if(users.length === 0){
    el.innerHTML = '<div style="padding:16px;font-size:12px;color:#9AB0B8;text-align:center">No approved users</div>';
    return;
  }
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<tr style="background:#F0F9FB"><th style="padding:8px 12px;text-align:left">Email</th><th style="padding:8px 12px">Plan</th><th style="padding:8px 12px">Status</th><th style="padding:8px 12px">Action</th></tr>';
  users.forEach(function(email){
    var u = IPOWORK_USERS[email];
    html += '<tr style="border-bottom:1px solid #F5F5F5">'
      +'<td style="padding:8px 12px;font-weight:600;color:#1A2E35">'+esc(email)+'</td>'
      +'<td style="padding:8px 12px;text-align:center"><span style="padding:2px 8px;background:'+(u.plan==='admin'?'#FFE8E8':'#E8F8EE')+';color:'+(u.plan==='admin'?'#C0392B':'#1A6B3A')+';border-radius:20px;font-size:11px;font-weight:600">'+u.plan+'</span></td>'
      +'<td style="padding:8px 12px;text-align:center;color:'+(u.approved?'#1A6B3A':'#8A6820')+'">'+( u.approved?'● Active':'○ Pending')+'</td>'
      +'<td style="padding:8px 12px;text-align:center"><button class="rm-user-btn" data-email="'+email+'" style="padding:3px 10px;background:#C0392B;color:#fff;border:none;border-radius:5px;font-size:11px;cursor:pointer">Remove</button></td>'
      +'</tr>';
  });
  html += '</table>';
  el.innerHTML = html;
  el.addEventListener('click',function(e){
    var b=e.target.closest('.rm-user-btn');
    if(b) removeUser(b.dataset.email);
  });
}



function rejectRequest(idx){
  try {
    var reqs = getPendingRequests();
    reqs.splice(idx,1);
    localStorage.setItem('aira_access_requests', JSON.stringify(reqs));
    loadPendingRequests();
  } catch(e){}
}

function loadAdmin(){
  var isAdm=(CURRENT_USER&&(CURRENT_USER.plan==='admin'||CURRENT_USER.email===ADMIN_EMAIL))||ADMIN_UNLOCKED;
  if(!isAdm){ return; }

  // Show admin user info
  var infoEl=document.getElementById('admin-user-info');
  if(infoEl&&CURRENT_USER){ infoEl.innerHTML='Logged in as<br><strong>'+esc(CURRENT_USER.email)+'</strong>'; }

  var stored=getStoredReports();
  var allUsers=Object.keys(IPOWORK_USERS);
  var pending=getPendingRequests();

  // Price map
  var PRICES={free:0,paid:999,mainboard:2499,ca:4999,clearchit:1999,
              dirscan:1499,ddbundle:4999,valdoc:2999,valintel:7999,deepresearch:4999};
  var TIER_NAMES={free:'AIRA Score',paid:'SME Intel',mainboard:'Mainboard ICDR',
    ca:'CA/CS Bundle',clearchit:'Clean Chit',dirscan:'Director Scan',
    ddbundle:'Due Diligence',valdoc:'Valuation Doc',valintel:'Val Intelligence',
    deepresearch:'Deep Research'};

  var revenue=stored.reduce(function(s,r){return s+(parseInt(PRICES[r.tier]||0,10));},0);
  var todayStr=new Date().toDateString();
  var todayReports=stored.filter(function(r){return r.timestamp&&new Date(r.timestamp).toDateString()===todayStr;}).length;

  // ── Stats cards ─────────────────────────────────────
  var statsEl=document.getElementById('admin-stats');
  if(statsEl){
    var statData=[
      {icon:'&#8377;',val:(revenue>=100000?'₹'+(revenue/100000).toFixed(1)+'L':revenue>0?'₹'+revenue.toLocaleString('en-IN'):'₹0'),lbl:'Est. Revenue',bg:'linear-gradient(135deg,#08404D,#0D5C6B)'},
      {icon:'&#128196;',val:stored.length,lbl:'Total Reports',bg:'linear-gradient(135deg,#1A3A5C,#1A5C8A)'},
      {icon:'&#128101;',val:allUsers.length,lbl:'Registered Users',bg:'linear-gradient(135deg,#1A4A2A,#1A7B3A)'},
      {icon:'&#8987;',val:todayReports,lbl:'Reports Today',bg:todayReports>0?'linear-gradient(135deg,#5C3A1A,#B5370A)':'linear-gradient(135deg,#2C4A5C,#1A5C8A)'}
    ];
    statsEl.innerHTML=statData.map(function(s){
      return '<div style="background:'+s.bg+';color:#fff;border-radius:10px;padding:16px 18px;box-shadow:0 3px 10px rgba(0,0,0,.1)">'
        +'<div style="font-size:28px;font-weight:900;line-height:1">'+s.val+'</div>'
        +'<div style="font-size:11px;opacity:.7;margin-top:5px;text-transform:uppercase;letter-spacing:.5px">'+s.lbl+'</div>'
        +'</div>';
    }).join('');
  }

  // ── Reports table ────────────────────────────────────
  var rEl=document.getElementById('admin-reports');
  var clearBtn=document.getElementById('btn-clear-history');
  if(rEl){
    if(!stored.length){
      rEl.innerHTML='<div style="padding:30px;text-align:center;color:#9AB0B8;font-size:13px">'
        +'&#128202; No reports generated yet.<br><span style="font-size:11px">Generate reports from the main tabs — they appear here automatically.</span></div>';
      if(clearBtn) clearBtn.style.display='none';
    } else {
      if(clearBtn) clearBtn.style.display='inline-block';
      var tbl='<table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<thead><tr style="background:#F0F6F8">'
        +'<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">#</th>'
        +'<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Date & Time</th>'
        +'<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Company</th>'
        +'<th style="padding:9px 12px;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Report Type</th>'
        +'<th style="padding:9px 12px;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Sector</th>'
        +'<th style="padding:9px 12px;text-align:right;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Value</th>'
        +'</tr></thead><tbody>';
      stored.slice().reverse().forEach(function(r,i){
        // Support both old field names (timestamp/company) and new (ts/cname)
        var tsRaw = r.ts||r.timestamp;
        var ts = tsRaw ? new Date(tsRaw).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        var companyName = r.cname||r.company||(r.result&&(r.result.company_name||r.result.cname))||'—';
        var price=PRICES[r.tier]||0;
        var tierColor={free:'#6B8A94',paid:'#1A5C8A',mainboard:'#1A3A5C',ca:'#1A4A2A',
          clearchit:'#3A1A5C',dirscan:'#5C3A1A',ddbundle:'#1A1A5C',
          valdoc:'#1A3A5C',valintel:'#3B30B0',deepresearch:'#3B30B0'}[r.tier]||'#6B8A94';
        tbl+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
          +'<td style="padding:8px 12px;color:#9AB0B8;font-size:11px">'+(stored.length-i)+'</td>'
          +'<td style="padding:8px 12px;color:#6B8A94;font-size:11px">'+ts+'</td>'
          +'<td style="padding:8px 12px;font-weight:600;color:#1A2E35">'+esc(companyName)+'</td>'
          +'<td style="padding:8px 12px;text-align:center"><span style="background:'+tierColor+';color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700">'+(TIER_NAMES[r.tier]||r.tier||'—')+'</span></td>'
          +'<td style="padding:8px 12px;color:#444">'+esc(r.sector||'—')+'</td>'
          +'<td style="padding:8px 12px;text-align:right;font-weight:700;color:'+(price>0?'#1A6B3A':'#9AB0B8')+'">'+(price>0?'₹'+price.toLocaleString('en-IN'):'Free')+'</td>'
          +'</tr>';
      });
      tbl+='</tbody></table>';
      rEl.innerHTML=tbl;
    }
  }

  // ── Pending requests ─────────────────────────────────
  var reqEl=document.getElementById('access-requests-list');
  if(reqEl){
    if(!pending.length){
      reqEl.innerHTML='<div style="padding:16px 18px;color:#9AB0B8;font-size:12px;text-align:center">&#10003; No pending access requests</div>';
    } else {
      reqEl.innerHTML=pending.map(function(r,i){
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
          +'<div><div style="font-weight:600;font-size:13px;color:#1A2E35">'+esc(r.name||'Unknown')+'</div>'
          +'<div style="font-size:11px;color:#6B8A94;margin-top:2px">'+esc(r.email||'—')
          +(r.firm?' &nbsp;·&nbsp; '+esc(r.firm):'')
          +(r.message?' &nbsp;·&nbsp; <em>'+esc(r.message.slice(0,60))+'</em>':'')
          +'</div></div>'
          +'<div style="display:flex;gap:8px;flex-shrink:0">'
          +'<button class="approve-req" data-email="'+esc(r.email||'')+'" data-name="'+esc(r.name||'')+'" style="padding:6px 14px;background:#1A6B3A;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">&#9989; Approve</button>'
          +'<button class="reject-req" data-email="'+esc(r.email||'')+'" style="padding:6px 10px;background:#FFF5F0;color:#C0392B;border:1px solid #F5C6C0;border-radius:7px;font-size:11px;cursor:pointer">&#10007;</button>'
          +'</div></div>';
      }).join('');
    }
  }

  // ── Users table ──────────────────────────────────────
  var uEl=document.getElementById('approved-users-list');
  if(uEl){
    if(!allUsers.length){
      uEl.innerHTML='<div style="padding:16px 18px;color:#9AB0B8;font-size:12px">No users registered yet.</div>';
    } else {
      var PLAN_COLORS={admin:'#08404D',paid:'#1A5C8A',trial:'#B5370A',partner:'#3B30B0',ca:'#1A4A2A',mb:'#5C3A1A'};
      var utbl='<table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<thead><tr style="background:#F0F6F8">'
        +'<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Email</th>'
        +'<th style="padding:9px 12px;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Name</th>'
        +'<th style="padding:9px 12px;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Plan</th>'
        +'<th style="padding:9px 12px;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Status</th>'
        +'<th style="padding:9px 12px;border-bottom:2px solid #D0E4F0;font-weight:700;color:#08404D">Action</th>'
        +'</tr></thead><tbody>';
      allUsers.forEach(function(email,i){
        var u=IPOWORK_USERS[email];
        var pc=PLAN_COLORS[u.plan]||'#6B8A94';
        utbl+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
          +'<td style="padding:9px 12px;font-weight:600;color:#1A2E35">'+esc(email)+'</td>'
          +'<td style="padding:9px 12px;color:#444">'+esc(u.name||'—')+'</td>'
          +'<td style="padding:9px 12px;text-align:center"><span style="background:'+pc+';color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700">'+(u.plan||'paid').toUpperCase()+'</span></td>'
          +'<td style="padding:9px 12px"><span style="color:'+(u.approved?'#1A6B3A':'#E67E22')+';font-weight:600;font-size:12px">'+(u.approved?'&#9989; Active':'&#9203; Pending')+'</span></td>'
          +'<td style="padding:9px 12px">'
          +(email!==ADMIN_EMAIL
            ?'<button class="adm-rm" data-e="'+email+'" style="padding:4px 12px;background:#FFF5F0;color:#C0392B;border:1px solid #F5C6C0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">Remove</button>'
            :'<span style="color:#9AB0B8;font-size:11px;font-style:italic">Owner</span>')
          +'</td></tr>';
      });
      utbl+='</tbody></table>';
      uEl.innerHTML=utbl;
    }
  }

  // Event delegation
  var adminEl=document.getElementById('content-admin');
  if(adminEl){
    adminEl.onclick=function(e){
      var rm=e.target.closest('.adm-rm');
      if(rm) removeUser(rm.dataset.e);
      var ap=e.target.closest('.approve-req');
      if(ap) approveRequest(ap.dataset.email,ap.dataset.name||'');
      var rj=e.target.closest('.reject-req');
      if(rj){
        var reqs=getPendingRequests().filter(function(r){return r.email!==rj.dataset.email;});
        try{localStorage.setItem('aira_access_requests',JSON.stringify(reqs));}catch(ex){}
        loadAdmin();
      }
    };
  }

  showAdminTab('reports');
}


function reloadReport(key){
  var r = AIRA_RESULTS[key];
  if(!r) return;
  var outId = 'result-' + (r.tier || key);
  var out = document.getElementById(outId);
  if(!out){ 
    switchTier(r.tier || key);
    setTimeout(function(){ reloadReport(key); }, 200);
    return;
  }
  if(r.tier === 'valdoc' || r.tier === 'valintel'){
    renderValuationReport(r.result, r.cname, r.sector, out, r.tier);
  } else if(r.result && r.result._report){
    renderSimpleReport(r.result, r.cname, r.sector, out, r.tier);
  }
  switchTier(r.tier || key);
  out.scrollIntoView({behavior:'smooth',block:'start'});
}

function closeLogin(){
  var m = document.getElementById('login-modal');
  if(m) m.classList.remove('open');
}
function submitLogin(){
  closeLogin();
}
function openLogin(){
  var m = document.getElementById('login-modal');
  if(m) m.classList.add('open');
}



/* ════ SESSION & INIT ════ */
var SESS = {name:'', email:'', org:'', role:'', plan:'free'};


/* ════════════════════════════════════════════════════
   IPOWORK ACCESS CONTROL SYSTEM
   - All report generation requires approved login
   - Admin (jiweshkshrivastava@gmail.com) is always free
   - Admin can approve/revoke users from Admin panel
   ════════════════════════════════════════════════════ */

var IPOWORK_USERS = {
  'jiweshkshrivastava@gmail.com': {
    name: 'Jiwesh Shrivastava',
    password: 'ipowork@2007',
    approved: true,
    plan: 'admin',
    free: true
  }
};


// Load saved session
// Session restored via restoreSession() in DOMContentLoaded


function isLoggedIn(){ return !!CURRENT_USER && CURRENT_USER.email; }

function isApproved(){
  if(!CURRENT_USER) return false;
  var u = IPOWORK_USERS[CURRENT_USER.email];
  return u && u.approved;
}

function requireLoginThen(fn){
  if(isLoggedIn() && isApproved()){
    if(typeof fn==='function') fn();
    return;
  }
  // Show access gate
  showAccessGate(fn);
}


function gateShowTab(tab){
  var login = document.getElementById('gate-panel-login');
  var request = document.getElementById('gate-panel-request');
  var btnLogin = document.getElementById('gate-tab-login');
  var btnRequest = document.getElementById('gate-tab-request');
  if(tab === 'login'){
    if(login) login.style.display = '';
    if(request) request.style.display = 'none';
    if(btnLogin){ btnLogin.style.background='#08404D'; btnLogin.style.color='#fff'; }
    if(btnRequest){ btnRequest.style.background='#fff'; btnRequest.style.color='#08404D'; }
    var inp = document.getElementById('gate-email');
    if(inp) setTimeout(function(){ inp.focus(); }, 100);
  } else {
    if(login) login.style.display = 'none';
    if(request) request.style.display = '';
    if(btnRequest){ btnRequest.style.background='#08404D'; btnRequest.style.color='#fff'; }
    if(btnLogin){ btnLogin.style.background='#fff'; btnLogin.style.color='#08404D'; }
    var inp2 = document.getElementById('req-name');
    if(inp2) setTimeout(function(){ inp2.focus(); }, 100);
  }
}

function submitAccessRequest(){
  var name    = ((document.getElementById('req-name')||{}).value||'').trim();
  var phone   = ((document.getElementById('req-phone')||{}).value||'').trim();
  var email   = ((document.getElementById('req-email')||{}).value||'').trim().toLowerCase();
  var org     = ((document.getElementById('req-org')||{}).value||'').trim();
  var purpose = (document.getElementById('req-purpose')||{}).value||'';
  var errEl   = document.getElementById('req-error');
  
  if(!name){ if(errEl) errEl.textContent='Please enter your full name.'; return; }
  if(!phone){ if(errEl) errEl.textContent='Please enter your WhatsApp number.'; return; }
  if(!email || !email.includes('@')){ if(errEl) errEl.textContent='Please enter a valid email.'; return; }
  
  var req = {
    name: name, phone: phone, email: email, org: org, purpose: purpose,
    ts: new Date().toISOString(), status: 'pending'
  };

  // Save to localStorage
  try {
    var requests = JSON.parse(localStorage.getItem('ipowork_access_requests')||'[]');
    requests.push(req);
    localStorage.setItem('ipowork_access_requests', JSON.stringify(requests));
  } catch(e){}

  // Send WhatsApp notification to admin (opens WA with pre-filled message)
  var adminPhone = '919827XXXXXX'; // REPLACE with admin WhatsApp number
  var waMsg = encodeURIComponent(
    '🔔 *New ipowork Access Request*\n\n'
    +'👤 *Name:* '+name+'\n'
    +'📱 *Phone:* '+phone+'\n'
    +'📧 *Email:* '+email+'\n'
    +'🏢 *Org:* '+(org||'—')+'\n'
    +'🎯 *Purpose:* '+(purpose||'—')+'\n'
    +'🕐 *Time:* '+new Date().toLocaleString('en-IN')+'\n\n'
    +'To approve, login to ipowork.com/aira.html → Admin → Approve'
  );
  // 1. Notify admin via WhatsApp
  setTimeout(function(){
    window.open('https://wa.me/'+adminPhone+'?text='+waMsg, '_blank');
  }, 1500);

  // 2. Notify admin via email through worker
  workerPost({
    type: 'send_email',
    to: 'jiweshkshrivastava@gmail.com',
    subject: '🔔 New ipowork Access Request — '+name,
    html: '<h2>New Access Request<' + '/h2>'
      +'<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">'
      +'<tr><td style="padding:8px;font-weight:bold;color:#08404D">Name<' + '/td><td style="padding:8px">'+name+'<' + '/td><' + '/tr>'
      +'<tr><td style="padding:8px;font-weight:bold;color:#08404D">Phone (WhatsApp)<' + '/td><td style="padding:8px">'+phone+'<' + '/td><' + '/tr>'
      +'<tr><td style="padding:8px;font-weight:bold;color:#08404D">Email<' + '/td><td style="padding:8px">'+email+'<' + '/td><' + '/tr>'
      +'<tr><td style="padding:8px;font-weight:bold;color:#08404D">Organisation<' + '/td><td style="padding:8px">'+(org||'—')+'<' + '/td><' + '/tr>'
      +'<tr><td style="padding:8px;font-weight:bold;color:#08404D">Purpose<' + '/td><td style="padding:8px">'+(purpose||'—')+'<' + '/td><' + '/tr>'
      +'<tr><td style="padding:8px;font-weight:bold;color:#08404D">Time<' + '/td><td style="padding:8px">'+new Date().toLocaleString('en-IN')+'<' + '/td><' + '/tr>'
      +'<' + '/table>'
      +'<br><p>Login to <a href="https://ipowork.com/aira.html">ipowork Admin<' + '/a> to approve and send payment link.<' + '/p>'
      +'<br><p style="color:#888;font-size:12px">Auto-notification from ipowork.com<' + '/p>'
  }).catch(function(){});

  // Show success with instructions
  var panel = document.getElementById('gate-panel-request');
  if(panel) panel.innerHTML = 
    '<div style="text-align:center;padding:10px 0">'
    +'<div style="font-size:48px;margin-bottom:14px">🎉<' + '/div>'
    +'<div style="font-size:18px;font-weight:900;color:#08404D;margin-bottom:10px">Request Submitted!<' + '/div>'
    +'<div style="background:#F0F9FB;border:1px solid #D8EDF0;border-radius:10px;padding:16px;margin-bottom:16px;text-align:left">'
    +'<div style="font-size:12px;font-weight:700;color:#08404D;margin-bottom:8px">What happens next:<' + '/div>'
    +'<div style="font-size:12px;color:#1A2E35;line-height:2">'
    +'1️⃣ Admin reviews your request<br>'
    +'2️⃣ Payment link sent to <b>'+esc(phone)+'<' + '/b> (WhatsApp)<br>'
    +'3️⃣ Payment link also emailed to <b>'+esc(email)+'<' + '/b><br>'
    +'4️⃣ Access activated after payment confirmation'
    +'<' + '/div><' + '/div>'
    +'<div style="font-size:12px;color:#6B8A94;margin-bottom:14px">⏱ Typical activation: <b>2-4 hours<' + '/b><' + '/div>'
    +'<a href="mailto:jiweshkshrivastava@gmail.com?subject=ipowork+Access+Request+-+'+encodeURIComponent(name)+'&body=Hi+Jiwesh,+I+submitted+an+access+request.+Name:+'+encodeURIComponent(name)+'+Phone:+'+encodeURIComponent(phone)+'+Email:+'+encodeURIComponent(email)+'" '
    +'style="display:block;padding:10px;background:#08404D;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">📧 Also Email Us<' + '/a>'
    +'<' + '/div>';
}

function showAccessGate(callback){
  _loginCallback = callback;
  var gate = document.getElementById('access-gate');
  if(gate) {
    gate.style.display = 'flex';
    var inp = document.getElementById('gate-email');
    if(inp) inp.focus();
  }
}

function closeAccessGate(){
  var gate = document.getElementById('access-gate');
  if(gate) gate.style.display = 'none';
}

var _loginCallback = null;

function gateLogin(){
  var emailEl = document.getElementById('gate-email');
  var pwEl = document.getElementById('gate-password');
  var errEl = document.getElementById('gate-error');
  var email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  var pw = pwEl ? pwEl.value : '';

  if(!email || !pw){
    if(errEl) errEl.textContent = 'Please enter email and password.';
    return;
  }

  var u = IPOWORK_USERS[email];
  if(!u){
    if(errEl) errEl.textContent = '❌ Email not registered. Contact ipowork admin for access.';
    return;
  }
  if(!u.approved){
    if(errEl) errEl.textContent = '⏳ Your account is pending admin approval. Contact partners@ipowork.com';
    return;
  }
  if(u.password !== pw){
    if(errEl) errEl.textContent = '❌ Incorrect password.';
    return;
  }

  // Login success
  CURRENT_USER = {email: email, name: u.name, plan: u.plan, free: u.free};
  SESS.email = email; SESS.name = u.name; SESS.plan = u.plan;
  // Set ADMIN_UNLOCKED if admin
  if(u.plan === 'admin'){ ADMIN_UNLOCKED = true; window.ADMIN_UNLOCKED = true; }

  // Save session
  try {
    localStorage.setItem('ipowork_session', JSON.stringify({
      email: email,
      token: btoa(email + u.password),
      ts: Date.now()
    }));
  } catch(e){}

  closeAccessGate();
  updateUserUI();
  // Switch to appropriate tab after login
  if(!_loginCallback){
    var loggedUser = IPOWORK_USERS[email];
    if(loggedUser && loggedUser.plan === 'admin'){
      var aTab = document.getElementById('tab-admin');
      if(aTab) aTab.style.display = '';
      switchTier('admin');
    } else {
      switchTier('paid');
    }
  }
  if(_loginCallback){ var cb=_loginCallback; _loginCallback=null; cb(); }
}

function gateLogout(){
  CURRENT_USER = null;
  SESS.email=''; SESS.name=''; SESS.plan='free';
  try{ localStorage.removeItem('ipowork_session'); }catch(e){}
  updateUserUI();
  location.reload();
}

function updateUserUI(){
  var userEl = document.getElementById('user-display');
  if(!userEl) return;
  if(CURRENT_USER){
    var isAdmin = IPOWORK_USERS[CURRENT_USER.email] && IPOWORK_USERS[CURRENT_USER.email].plan === 'admin';
    if(isAdmin){ ADMIN_UNLOCKED = true; window.ADMIN_UNLOCKED = true; }
    // Show/hide admin tab based on role
    var adminTab = document.getElementById('tab-admin');
    var adminContent = document.getElementById('content-admin');
    var adminTopBtn = document.querySelector('button[onclick*="openAdminAuth"]');
    if(adminTab) adminTab.style.display = isAdmin ? '' : 'none';
    if(adminContent && !isAdmin) adminContent.style.display = 'none';
    // Keep topbar admin button always visible - it handles auth itself
    // Update topbar
    userEl.innerHTML = '<span style="font-size:12px;color:var(--tl);font-weight:600">👤 '+esc(CURRENT_USER.name||CURRENT_USER.email)+'<' + '/span>'
      +' <button onclick="gateLogout()" style="font-size:10px;padding:2px 8px;background:rgba(13,92,107,.1);border:1px solid var(--bdr);border-radius:4px;cursor:pointer;color:var(--tl)">Logout<' + '/button>';
  } else {
    // Hide admin elements for logged-out users
    var adminTab2 = document.getElementById('tab-admin');
    var adminContent2 = document.getElementById('content-admin');
    var adminTopBtn2 = document.querySelector('button[onclick*="openAdminAuth"]');
    if(adminTab2) adminTab2.style.display = 'none';
    if(adminContent2) adminContent2.style.display = 'none';
    // Topbar admin button stays visible for password-based access
    if(adminTopBtn2) adminTopBtn2.style.display = 'none';
    userEl.innerHTML = '<button onclick="showAccessGate(null)" style="font-size:11px;padding:4px 12px;background:var(--tl);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">Login<' + '/button>';
  }
}

/* ── ADMIN USER MANAGEMENT ── */
function addApprovedUser(email, name, password, plan){
  email = email.trim().toLowerCase();
  IPOWORK_USERS[email] = {
    name: name||email,
    password: password||'ipowork2024',
    approved: true,
    plan: plan||'paid',
    free: false,
    approvedBy: 'admin',
    approvedAt: new Date().toISOString()
  };
  // Save to localStorage for persistence
  try {
    var users = JSON.parse(localStorage.getItem('ipowork_approved_users')||'{}');
    users[email] = IPOWORK_USERS[email];
    localStorage.setItem('ipowork_approved_users', JSON.stringify(users));
  } catch(e){}
  renderApprovedUsers();
  return true;
}

function revokeUser(el){ var email=typeof el==='string'?el:(el.dataset?el.dataset.e:el);
  if(email === 'jiweshkshrivastava@gmail.com') { alert('Cannot revoke admin account.'); return; }
  if(IPOWORK_USERS[email]) IPOWORK_USERS[email].approved = false;
  try {
    var users = JSON.parse(localStorage.getItem('ipowork_approved_users')||'{}');
    if(users[email]) users[email].approved = false;
    localStorage.setItem('ipowork_approved_users', JSON.stringify(users));
  } catch(e){}
  renderApprovedUsers();
}

function deleteUser(el){ var email=typeof el==='string'?el:(el.dataset?el.dataset.e:el);
  if(email === 'jiweshkshrivastava@gmail.com') { alert('Cannot delete admin account.'); return; }
  if(!confirm('Delete user '+email+'?')) return;
  delete IPOWORK_USERS[email];
  try {
    var users = JSON.parse(localStorage.getItem('ipowork_approved_users')||'{}');
    delete users[email];
    localStorage.setItem('ipowork_approved_users', JSON.stringify(users));
  } catch(e){}
  renderApprovedUsers();
}

function loadSavedUsers(){
  try {
    var saved = JSON.parse(localStorage.getItem('ipowork_approved_users')||'{}');
    Object.assign(IPOWORK_USERS, saved);
  } catch(e){}
}

function renderAccessRequests(){
  var el = document.getElementById('access-requests-list');
  if(!el) return;
  try {
    var reqs = JSON.parse(localStorage.getItem('ipowork_access_requests')||'[]');
    if(!reqs.length){ el.innerHTML='<div style="padding:12px;color:#6B8A94;font-size:12px">No pending requests<' + '/div>'; return; }
    el.innerHTML = reqs.map(function(r, i){
      return '<div style="padding:10px 14px;border-bottom:1px solid #E0EEF0;display:flex;align-items:center;gap:12px">'
        +'<div style="flex:1">'
        +'<div style="font-size:12px;font-weight:700;color:#08404D">'+xe(r.name)+'<' + '/div>'
        +'<div style="font-size:11px;color:#6B8A94">📧 '+xe(r.email)+'<' + '/div>'
        +'<div style="font-size:11px;color:#1A9E6B;font-weight:600">📱 '+xe(r.phone||'—')+'<' + '/div>'
        +'<div style="font-size:11px;color:#6B8A94">🏢 '+xe(r.org||'—')+' · '+xe(r.purpose||'')+'<' + '/div>'
        +'<div style="font-size:10px;color:#9AB0B8;margin-top:2px">'+(r.ts?new Date(r.ts).toLocaleString('en-IN'):'')+' · '
        +'<a href="https://wa.me/'+encodeURIComponent((r.phone||'').replace(/[^0-9]/g,'').replace(/^0/,'91'))+'?text='+encodeURIComponent('Hi '+r.name+', Your ipowork access request is approved. Kindly pay ₹499 to activate: [PAYMENT LINK]. Reply to confirm.')+'" target="_blank" style="color:#1A9E6B;font-weight:700">📲 Send WA<' + '/a>'
        +'<' + '/div><' + '/div>'
        +'<button onclick="approveRequest('+i+')" style="padding:5px 12px;background:#1A9E6B;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Approve<' + '/button>'
        +'<' + '/div>';
    }).join('');
  } catch(e){ el.innerHTML='<div style="padding:12px;color:#C0392B;font-size:12px">Error loading requests<' + '/div>'; }
}

function approveRequest(i){
  try {
    var reqs = JSON.parse(localStorage.getItem('ipowork_access_requests')||'[]');
    var r = reqs[i];
    if(!r) return;
    var defaultPw = 'ipowork2024';
    addApprovedUser(r.email, r.name, defaultPw, 'paid');
    reqs.splice(i, 1);
    localStorage.setItem('ipowork_access_requests', JSON.stringify(reqs));
    renderAccessRequests();
    alert('✅ '+r.name+' approved!\nCredentials: '+r.email+' / '+defaultPw+'\nPlease share these with the user.');
  } catch(e){ alert('Error: '+e.message); }
}

function renderApprovedUsers(){
  var el = document.getElementById('approved-users-list');
  if(!el) return;
  var rows = Object.entries(IPOWORK_USERS).map(function(entry){
    var email=entry[0], u=entry[1];
    var isAdmin = email==='jiweshkshrivastava@gmail.com';
    return '<tr style="border-bottom:1px solid #E0EEF0">'
      +'<td style="padding:8px 12px;font-size:12px">'+xe(email)+'<' + '/td>'
      +'<td style="padding:8px 12px;font-size:12px">'+xe(u.name||'—')+'<' + '/td>'
      +'<td style="padding:8px 12px;font-size:12px"><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:'+(u.approved?'rgba(26,158,107,.1)':'rgba(192,57,43,.1)')+';color:'+(u.approved?'#1A9E6B':'#C0392B')+'">'+(u.approved?'✅ Active':'⛔ Revoked')+'<' + '/span><' + '/td>'
      +'<td style="padding:8px 12px;font-size:12px"><span style="padding:2px 8px;border-radius:20px;background:rgba(13,92,107,.08);color:#0D5C6B;font-size:10px;font-weight:700">'+xe(u.plan||'paid')+'<' + '/span><' + '/td>'
      +'<td style="padding:8px 12px">'
      +(isAdmin ? '<span style="font-size:10px;color:#6B8A94">Admin<' + '/span>' :
        '<button data-e="'+xe(email)+'" onclick="revokeUser(this.dataset.e)" style="font-size:10px;padding:2px 8px;border:1px solid #E88A2E;color:#E88A2E;border-radius:4px;cursor:pointer;background:#fff;margin-right:4px">'+(u.approved?'Revoke':'Restore')+'<' + '/button>'
        +'<button data-e="'+xe(email)+'" onclick="deleteUser(this.dataset.e)" style="font-size:10px;padding:2px 8px;border:1px solid #C0392B;color:#C0392B;border-radius:4px;cursor:pointer;background:#fff">Delete<' + '/button>')
      +'<' + '/td><' + '/tr>';
  }).join('');
  el.innerHTML = '<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr style="background:#F0F9FB">'
    +'<th style="padding:8px 12px;text-align:left;font-size:10px;color:#6B8A94;font-weight:700;text-transform:uppercase">Email<' + '/th>'
    +'<th style="padding:8px 12px;text-align:left;font-size:10px;color:#6B8A94;font-weight:700;text-transform:uppercase">Name<' + '/th>'
    +'<th style="padding:8px 12px;text-align:left;font-size:10px;color:#6B8A94;font-weight:700;text-transform:uppercase">Status<' + '/th>'
    +'<th style="padding:8px 12px;text-align:left;font-size:10px;color:#6B8A94;font-weight:700;text-transform:uppercase">Plan<' + '/th>'
    +'<th style="padding:8px 12px;text-align:left;font-size:10px;color:#6B8A94;font-weight:700;text-transform:uppercase">Actions<' + '/th>'
    +'<' + '/tr><' + '/thead><tbody>'+rows+'<' + '/tbody><' + '/table>';
}

function addUserFromForm(){
  var email = (document.getElementById('new-user-email')||{}).value||'';
  var name  = (document.getElementById('new-user-name')||{}).value||'';
  var pw    = (document.getElementById('new-user-pw')||{}).value||'ipowork2024';
  var plan  = (document.getElementById('new-user-plan')||{}).value||'paid';
  if(!email || !email.includes('@')){ alert('Valid email required.'); return; }
  addApprovedUser(email.trim(), name.trim(), pw.trim(), plan);
  // Clear form
  ['new-user-email','new-user-name','new-user-pw'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  alert('✅ User '+email+' approved!');
}

// requireLoginThen replaced by AUTH_SYSTEM above


/* ════ DOCUMENT UPLOAD — AIRA SCORE TAB ════ */
var DOC_FILES = {}; // stores {slotId: {name, text, base64}}

function fileSelected(slot, input){
  if(!input.files||!input.files[0]) return;
  var file = input.files[0];
  var slot_el = document.getElementById('slot-'+slot);
  var status_el = document.getElementById('status-'+slot);
  
  // Update UI
  if(slot_el) slot_el.classList.add('has-file');
  if(status_el) status_el.textContent = '✓ '+file.name.substring(0,25);
  
  // Read file as text (for PDFs/Excel just get filename for now)
  var reader = new FileReader();
  reader.onload = function(e){
    DOC_FILES[slot] = {
      name: file.name,
      size: file.size,
      type: file.type,
      text: '[File: '+file.name+' ('+Math.round(file.size/1024)+'KB)]'
    };
    updateUploadCount();
  };
  reader.readAsArrayBuffer(file); // trigger onload
  
  // For text extraction, read as text too
  var reader2 = new FileReader();
  reader2.onload = function(e2){
    if(DOC_FILES[slot]){
      // Store first 3000 chars of text content
      var txt = e2.target.result||'';
      if(typeof txt === 'string' && txt.length > 10){
        DOC_FILES[slot].text = '['+file.name+']: '+txt.substring(0,3000);
      }
    }
  };
  reader2.onerror = function(){};
  try { reader2.readAsText(file); } catch(e){}
}

function updateUploadCount(){
  var count = Object.keys(DOC_FILES).length;
  var el = document.getElementById('upload-count-label');
  var complete_el = document.getElementById('upload-complete-label');
  if(el) el.textContent = count + ' document' + (count!==1?'s':'') + ' uploaded';
  if(complete_el) complete_el.style.display = count > 0 ? 'flex' : 'none';
  var summary = document.getElementById('upload-summary');
  if(summary) summary.textContent = count > 0 ? count+' files ready for AI analysis' : '';
}

async function runDocCore(){
  var cname = (document.getElementById('d-cname')||{}).value||'';
  var cin   = (document.getElementById('d-cin')||{}).value||'';
  var sector = (document.getElementById('d-sector')||{}).value||'Manufacturing';
  var exchange = (document.getElementById('d-exchange')||{}).value||'NSE Emerge (SME)';
  
  cname = cname.trim(); cin = cin.trim().toUpperCase();
  if(!cname){ alert('Please enter company name.'); return; }
  
  var btn = document.getElementById('btn-doc-run');
  var prog = document.getElementById('prog-doc');
  var out  = document.getElementById('result-doc');
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner"><' + '/span> Analysing…'; }
  if(out) out.innerHTML='';
  if(prog) prog.style.display='flex';
  
  // Build document context from uploaded files
  var docCount = Object.keys(DOC_FILES).length;
  var docContext = '';
  if(docCount > 0){
    docContext = 'UPLOADED DOCUMENTS ('+docCount+' files):\n';
    Object.values(DOC_FILES).forEach(function(d){
      docContext += d.text.substring(0, 2000) + '\n---\n';
    });
  }
  
  // Try Probe42 if CIN provided
  var p42ctx = '';
  if(cin){
    try{
      var p42 = await workerPost({type:'probe42_raw', cin:cin});
      if(p42 && p42.company_name && p42.company_name !== 'NOT FOUND'){
        if(!cname) cname = p42.company_name;
        var f = p42.financials||{};
        var fC=function(v){if(!v||isNaN(v))return'N/A';var n=Number(v);return n>=10000000?'₹'+(n/10000000).toFixed(1)+' Cr':n>=100000?'₹'+(n/100000).toFixed(1)+' L':'₹'+n.toFixed(0);};
        var fP=function(v){return v!=null&&!isNaN(v)?parseFloat(v).toFixed(1)+'%':'N/A';};
        p42ctx = '\nPROBE42 MCA DATA:\nRevenue: '+fC(f.revenue_fy24)+' | PAT: '+fC(f.pat_fy24)
          +' | EBITDA%: '+fP(f.ebitda_margin)+' | NetWorth: '+fC(f.net_worth)
          +' | D/E: '+(f.debt_equity_ratio||'N/A')+'x | ROE: '+fP(f.roe)
          +'\nAuditor: '+(f.auditor||'N/A')+' | Defaulter: No\n';
      }
    }catch(e){}
  }
  
  var isMB = exchange.indexOf('Main') > -1;
  var prompt = 'You are AIRA, India top SEBI IPO Readiness AI. Score this company based on uploaded documents.\n\n'
    +'Company: '+cname+(cin?' | CIN: '+cin:'')+'\nSector: '+sector+' | Exchange: '+exchange+'\n'
    +p42ctx
    +(docContext||'(No documents uploaded — use sector knowledge and company name to estimate)\n')
    +'\nWrite a COMPLETE IPO Readiness Report. Minimum 1000 words. ALL 9 sections required:\n\n'
    +'## 1. Executive Summary\n'
    +'## 2. SEBI '+(isMB?'Mainboard ICDR':'SME IPO')+' Eligibility (criteria table)\n'
    +'## 3. Financial Analysis (table with all key metrics)\n'
    +'## 4. Listed Peer Benchmarks (3 real companies, P/E, EV/EBITDA table)\n'
    +'## 5. Governance & Board Quality\n'
    +'## 6. Compliance Status (table)\n'
    +'## 7. Key Gaps & Action Plan (8 items, numbered, with timeline)\n'
    +'## 8. IPO Roadmap (Phase 1/2/3)\n'
    +'## 9. Conclusion & Verdict\n\n'
    +'After the full report, append:\n'
    +'---DIMS---\n'
    +'{"score":0,"financial":0,"governance":0,"compliance":0,"promoter":0,"legal":0,"readiness":0}\n'
    +'---DIMS---';

  try{
    var resp = await workerPost({
      type:'claudeProxy',
      model:'claude-haiku-4-5-20251001',
      max_tokens:3000,
      system:'You are AIRA, India top SEBI IPO Readiness expert. Write COMPLETE detailed reports from uploaded documents. Minimum 1000 words. Never truncate any section.',
      messages:[{role:'user', content:prompt}]
    });
    
    var txt = (resp&&resp.content||[]).map(function(c){return c.text||'';}).join('');
    if(!txt && resp&&resp.error) throw new Error(resp.error.message||JSON.stringify(resp.error));
    if(!txt) throw new Error('Empty response. Check ANTHROPIC_API_KEY in Worker Secrets.');
    
    // Parse dims
    var dims = {score:65,financial:60,governance:60,compliance:60,promoter:60,legal:60,readiness:60,
                company_name:cname,cin:cin,sector:sector,exchange:exchange};
    var dm = txt.match(/---DIMS---\s*([\s\S]*?)\s*---DIMS---/);
    if(dm){try{dims=Object.assign(dims,JSON.parse(dm[1].trim()));}catch(e){}}
    var clean = txt.replace(/---DIMS---[\s\S]*?---DIMS---/g,'')
                   .replace(/```json[\s\S]*?```/g,'').replace(/```[\s\S]*?```/g,'').trim();
    
    if(btn){btn.disabled=false;btn.innerHTML='Generate AIRA Score →';}
    if(prog)prog.style.display='none';
    
    var result = Object.assign({},dims,{_report:clean,_type:'doc'});
    AIRA_RESULTS['doc'] = {result:result,cname:cname,sector:sector,exchange:exchange,tier:'doc'};
    renderAIRAReport(result, cname, sector, exchange, out, 'doc');
    if(out) out.scrollIntoView({behavior:'smooth',block:'start'});
    
  }catch(e){
    if(btn){btn.disabled=false;btn.innerHTML='Generate AIRA Score →';}
    if(prog)prog.style.display='none';
    if(out) out.innerHTML='<div class="err-card"><b>Error:<' + '/b> '+esc(e.message)+'<' + '/div>';
  }
}



var WORKER = 'https://flat-bread-b021.jiweshkshrivastava.workers.dev/';

async function workerPost(payload) {
  var type = payload.type || 'unknown';
  // Hard 25-second timeout — kills hanging fetches
  var ctrl = new AbortController();
  var tid = setTimeout(function(){ ctrl.abort(); }, 90000);
  try {
    var resp = await fetch(WORKER, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    var text = await resp.text();
    try { return JSON.parse(text); }
    catch(e) {
      throw new Error('['+type+'] HTTP ' + resp.status + ': ' + text.substring(0, 200));
    }
  } catch(e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') {
      throw new Error('['+type+'] Request timed out after 90s. Worker may be overloaded or not deployed. Visit https://flat-bread-b021.jiweshkshrivastava.workers.dev/ — should show v10.7 OK');
    }
    if (e.message.startsWith('[')) throw e;
    throw new Error('['+type+'] Network error: ' + e.message);
  }
}


var SB_URL = 'https://esqlfsjhekdspycfgnoz.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcWxmc2poZWtkc3B5Y2Znbm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MzE4ODUsImV4cCI6MjA5MDMwNzg4NX0.nuJCy5xn0K6IpWptphUHv8iXK5xxPm_Eqx-1XzgVHFc';

/* Supabase fetch helper */
function sbFetch(path, opts) {
  return fetch(SB_URL + '/rest/v1/' + path, Object.assign({
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    }
  }, opts || {}));
}




/* ═══════════════════════════
   UI HELPERS
═══════════════════════════ */
function switchTier(t){
  // Block admin access for non-admins (unless ADMIN_UNLOCKED via password)
  if(t==='admin'){
    var u = CURRENT_USER && IPOWORK_USERS[CURRENT_USER.email];
    var isAdm = (u && (u.plan==='admin'||CURRENT_USER.email===ADMIN_EMAIL)) || ADMIN_UNLOCKED;
    if(!isAdm){
      if(!isLoggedIn()){
        showAccessGate(function(){ switchTier('admin'); });
      } else {
        openAdminAuth();
      }
      return;
    }
    ADMIN_UNLOCKED=true; window.ADMIN_UNLOCKED=true;
    // Show admin tab in sidebar when accessing admin
    var aTab = document.getElementById('tab-admin');
    if(aTab) aTab.style.display = '';
  }
  ['free','paid','mainboard','ca','deepresearch','clearchit','dirscan','ddbundle','alert','valdoc','valintel','admin'].forEach(function(id){
    var c=document.getElementById('content-'+id);
    var tb=document.getElementById('tab-'+id);
    if(c) c.style.display = (id===t) ? 'block' : 'none';
    if(tb) tb.classList.toggle('active',id===t);
  });
  if(t==='admin'){ setTimeout(function(){ loadAdmin(); showAdminTab('reports'); }, 100); }

  // Mobile: sync active tab highlight on bottom nav
  document.querySelectorAll('.tg-tab').forEach(function(b){
    var isActive = b.id === 'tab-'+t;
    b.style.color = isActive ? 'var(--tl)' : '';
    b.style.borderTopColor = isActive ? 'var(--tl)' : 'transparent';
    b.style.background = isActive ? 'rgba(13,92,107,.06)' : 'transparent';
    b.style.fontWeight = isActive ? '700' : '600';
  });
  // Sync mobile full report button
  var mBtn = document.getElementById('btn-full-report-m');
  if(mBtn) mBtn.style.display = Object.keys(AIRA_RESULTS).length>0 ? 'inline-block' : 'none';
}
function resetAll(){
  ['f-cin','f-cname','p-cin','p-cname','zauba-search','zauba-search-p'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  ['result-free','result-paid','zauba-results','zauba-results-p'].forEach(function(id){var e=document.getElementById(id);if(e)e.innerHTML='';});
  ['prog-free','prog-paid'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display='none';});
}
function stepDone(id){var e=document.getElementById(id);if(e){e.classList.remove('active');e.classList.add('done');}}
function stepActive(id){var e=document.getElementById(id);if(!e)return;e.classList.remove('done');e.classList.add('active');}
function clearStep(id){var e=document.getElementById(id);if(e)e.classList.remove('active','done');}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function sc(s){return s>=78?'#1A9E6B':s>=60?'#C9932A':'#C0392B';}
function vd(s){
  if(s>=78)return{label:'Main Board Eligible',bg:'rgba(26,158,107,.1)',txt:'#0F6E4A'};
  if(s>=65)return{label:'SME IPO Eligible',bg:'rgba(201,147,42,.1)',txt:'#7A5B1A'};
  if(s>=50)return{label:'SME with Gaps',bg:'rgba(201,147,42,.1)',txt:'#7A5B1A'};
  return{label:'Not IPO-Ready',bg:'rgba(192,57,43,.1)',txt:'#8B2B20'};
}
function dimIcon(k){return{financial:'💹',governance:'🏛',compliance:'✅',promoter:'👤',legal:'⚖️',readiness:'📋'}[k]||'•';}
function dimLabel(k){return{financial:'Financial Strength',governance:'Governance',compliance:'Compliance',promoter:'Promoter Quality',legal:'Legal & IP',readiness:'IPO Readiness'}[k]||k;}
function dimVerd(s){return s>=78?'Strong':s>=65?'Adequate':s>=50?'Needs work':'Critical gap';}
function dialSVG(score,col){
  var r=40,cx=48,cy=48,circ=2*Math.PI*r,dash=circ*(score/100),gap=circ-dash;
  return '<svg width="96" height="96" viewBox="0 0 96 96">'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="7"/>'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="7" '
    +'stroke-dasharray="'+dash.toFixed(1)+' '+gap.toFixed(1)+'" stroke-linecap="round" '
    +'style="transform:rotate(-90deg);transform-origin:'+cx+'px '+cy+'px"/><' + '/svg>';
}
function pickCompany(idx){
  var co = (window._searchResults||[])[idx];
  if(!co) return;
  var cinEl = document.getElementById(window._searchCinId||'f-cin');
  var nameEl = document.getElementById(window._searchNameId||'f-cname');
  var resEl = document.getElementById(window._searchResId||'zauba-results');
  if(cinEl && co.cin && co.cin!=='UNKNOWN') cinEl.value = co.cin;
  if(nameEl) nameEl.value = co.name;
  if(resEl) resEl.innerHTML = '<div style="font-size:12px;color:var(--ok);padding:4px 0">✓ Selected: '+esc(co.name)+'<' + '/div>';
}


function searchZauba(tier){
  // Find the search input for this tier
  var IDS_SEARCH = {
    'p':'p-cin','mb':'mb-search','ca':'ca-search','cl':'clearchit-search',
    'dirscan':'dirscan-search','dd':'ddbundle-search','alert':'alert-search',
    'va':'valdoc-search','valintel':'valintel-search','free':'d-cin'
  };
  var searchId = IDS_SEARCH[tier] || (tier+'-search');
  var el = document.getElementById(searchId);
  var q = el ? el.value.trim() : '';
  if(!q){ alert('Please enter a company name or CIN to search.'); return; }
  doSearch(q, tier);
}

function doSearch(q,tier){
  if(!q||q.length<3)return;
  // Map tier → correct element IDs
  var IDS={
    free:         {res:'zauba-results',        cin:'d-cin',          name:'d-cname',      search:'d-cin'},
    paid:         {res:'zauba-results-p',       cin:'p-cin',          name:'p-cname',      search:'p-cin'},
    p:            {res:'zauba-results-p',       cin:'p-cin',          name:'p-cname',      search:'p-cin'},
    mainboard:    {res:'zauba-results-mb',      cin:'mb-cin',         name:'mb-cname',     search:'mb-search'},
    mb:           {res:'zauba-results-mb',      cin:'mb-cin',         name:'mb-cname',     search:'mb-search'},
    ca:           {res:'zauba-results-ca',      cin:'ca-cin',         name:'ca-cname',     search:'ca-search'},
    cl:           {res:'zauba-results-cl',      cin:'clearchit-cin',  name:'clearchit-cname', search:'clearchit-search'},
    clearchit:    {res:'zauba-results-cl',      cin:'clearchit-cin',  name:'clearchit-cname', search:'clearchit-search'},
    dirscan:      {res:'zauba-results-dirscan', cin:'dirscan-cin',    name:'dirscan-cname',search:'dirscan-search'},
    dd:           {res:'zauba-results-dd',      cin:'ddbundle-cin',   name:'ddbundle-cname',search:'ddbundle-search'},
    ddbundle:     {res:'zauba-results-dd',      cin:'ddbundle-cin',   name:'ddbundle-cname',search:'ddbundle-search'},
    alert:        {res:'zauba-results-alert',   cin:'alert-cin',      name:'alert-cname',  search:'alert-search'},
    valdoc:       {res:'zauba-results-vd',      cin:'valdoc-cin',     name:'valdoc-cname', search:'valdoc-search'},
    va:           {res:'zauba-results-vd',      cin:'valdoc-cin',     name:'valdoc-cname', search:'valdoc-search'},
    valintel:     {res:'zauba-results-vi',      cin:'valintel-cin',   name:'valintel-cname',search:'valintel-search'},
    deepresearch: {res:'zauba-results-dr',      cin:'dr-cin',         name:'dr-cname',     search:'dr-search'},
    dr:           {res:'zauba-results-dr',      cin:'dr-cin',         name:'dr-cname',     search:'dr-search'},
  };
  var ids=IDS[tier]||IDS.free;
  var resEl=document.getElementById(ids.res);
  var cinId=ids.cin; var nameId=ids.name;

  var cinRx=/^[ULul][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/i;
  if(cinRx.test(q.trim())){
    var ci=document.getElementById(cinId);
    if(ci) ci.value=q.trim().toUpperCase();
    if(resEl) resEl.innerHTML='<div style="font-size:12px;color:var(--ok);padding:4px 0">✓ CIN detected — ready to run<' + '/div>';
    return;
  }
  if(resEl) resEl.innerHTML='<div style="font-size:12px;color:var(--mu);padding:6px 0">🔍 Searching...<' + '/div>';
  fetch(WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'company_search',query:q})})

  .then(function(r){return r.json();})
  .then(function(d){
    if(!resEl)return;
    var results=d.results||[];
    if(!results.length){
      resEl.innerHTML='<div style="font-size:12px;color:var(--mu);padding:6px 0">No results. Enter CIN directly.<' + '/div>';
      return;
    }
    window._searchResults=results;
    window._searchCinId=cinId;
    window._searchNameId=nameId;
    window._searchResId=resEl.id;
    resEl.innerHTML=results.map(function(co,idx){
      var hasCin=co.cin&&co.cin!=='UNKNOWN';
      return '<div onclick="pickCompany('+idx+')" style="padding:8px 12px;background:#fff;border:1px solid #E2E8EA;border-radius:8px;cursor:pointer;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">'
        +'<div><div style="font-size:13px;font-weight:600;color:#2C3E47">'+esc(co.name)+'<' + '/div>'
        +(hasCin?'<div style="font-size:11px;color:#6B7E85;font-family:monospace">'+esc(co.cin)+'<' + '/div>':'')
        +'<' + '/div><span style="font-size:11px;color:#0D5C6B">Select →<' + '/span><' + '/div>';
    }).join('');
  })
  .catch(function(){
    if(resEl) resEl.innerHTML='<div style="font-size:12px;color:var(--mu);padding:6px 0">Search unavailable. Enter CIN directly.<' + '/div>';
  });
}


/* ═══════════════════════════
   BENCHMARK
═══════════════════════════ */
var BENCH={
  'Manufacturing':{p25:52,p50:63,p75:74,p90:82,avg:64,label:'Manufacturing SME',s:{low:1.8,mid:2.4,hi:3.1}},
  'Pharma':{p25:55,p50:66,p75:76,p90:85,avg:67,label:'Pharma SME',s:{low:2.1,mid:2.9,hi:3.6}},
  'IT Services':{p25:58,p50:68,p75:78,p90:87,avg:69,label:'IT Services SME',s:{low:2.3,mid:3.1,hi:4.0}},
  'Auto Components':{p25:50,p50:61,p75:73,p90:81,avg:62,label:'Auto Components SME',s:{low:1.7,mid:2.3,hi:3.0}},
  'FMCG':{p25:54,p50:65,p75:75,p90:84,avg:66,label:'FMCG SME',s:{low:2.0,mid:2.7,hi:3.5}},
  'Chemicals':{p25:53,p50:64,p75:74,p90:83,avg:65,label:'Chemicals SME',s:{low:1.9,mid:2.6,hi:3.3}},
  'Financial Services':{p25:56,p50:67,p75:77,p90:86,avg:68,label:'Financial Services SME',s:{low:2.2,mid:3.0,hi:3.8}},
  'Healthcare':{p25:55,p50:65,p75:75,p90:84,avg:66,label:'Healthcare SME',s:{low:2.1,mid:2.8,hi:3.6}},
  'Other':{p25:51,p50:62,p75:72,p90:80,avg:63,label:'SME',s:{low:1.8,mid:2.4,hi:3.2}},
};
function renderBenchmark(score,sector){
  var b=BENCH[sector]||BENCH['Other'];
  var pct=0;
  if(score<=b.p25)pct=Math.round((score/b.p25)*25);
  else if(score<=b.p50)pct=Math.round(25+(score-b.p25)/(b.p50-b.p25)*25);
  else if(score<=b.p75)pct=Math.round(50+(score-b.p50)/(b.p75-b.p50)*25);
  else if(score<=b.p90)pct=Math.round(75+(score-b.p75)/(b.p90-b.p75)*15);
  else pct=Math.min(99,90+Math.round((score-b.p90)/10*9));
  var topPct=100-pct;
  var posLabel=topPct<=10?'Top 10%':topPct<=25?'Top 25%':topPct<=40?'Top 40%':'Below Average';
  var ipoMult=score>=80?b.s.hi:score>=70?b.s.mid:b.s.low;
  var outrankC=pct>=75?'#6DDC9E':pct>=50?'#F5A94E':'#F4A09A';
  var vsLabel=(score-b.avg)>0?'+'+(score-b.avg)+' pts above avg':Math.abs(score-b.avg)+' pts below avg';
  window._bmBarPct=pct;
  var h='<div class="bm-card">';
  h+='<div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:16px">📊 Industry Benchmark — '+esc(b.label)+'<' + '/div>';
  h+='<div class="bm-stats-row">';
  h+='<div class="bm-stat-box"><div class="bm-stat-number" style="color:'+outrankC+'">'+pct+'%<' + '/div><div class="bm-stat-label">Companies you<br>outperform<' + '/div><' + '/div>';
  h+='<div class="bm-stat-box"><div class="bm-stat-number" style="color:#E88A2E">'+esc(posLabel)+'<' + '/div><div class="bm-stat-label">Sector<br>positioning<' + '/div><' + '/div>';
  h+='<div class="bm-stat-box"><div class="bm-stat-number" style="color:#6DDC9E">'+ipoMult+'×<' + '/div><div class="bm-stat-label">IPO success vs<br>sector average<' + '/div><' + '/div>';
  h+='<' + '/div>';
  h+='<div style="margin-bottom:16px">';
  h+='<div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.55);margin-bottom:7px"><span>0<' + '/span><span>Avg '+b.avg+'<' + '/span><span>SME ≥65<' + '/span><span>Main ≥78<' + '/span><span>100<' + '/span><' + '/div>';
  h+='<div class="bm-bar-track"><div class="bm-bar-fill" id="bm-bar-fill"><' + '/div><' + '/div>';
  h+='<div style="display:flex;justify-content:space-between;margin-top:5px"><span style="font-size:10px;color:rgba(255,255,255,.3)">0<' + '/span><span style="font-size:10px;color:rgba(255,255,255,.3)">Median<' + '/span><span style="font-size:10px;color:rgba(255,255,255,.3)">SME<' + '/span><span style="font-size:10px;color:rgba(255,255,255,.3)">Main<' + '/span><span style="font-size:10px;color:rgba(255,255,255,.3)">100<' + '/span><' + '/div>';
  h+='<' + '/div>';
  h+='<div class="bm-insights-row">';
  h+='<div class="bm-insight-card"><div style="font-size:20px;margin-bottom:6px">🎯<' + '/div><div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px">Score '+score+' = '+esc(posLabel)+' in '+esc(b.label)+'<' + '/div><div style="font-size:11px;color:rgba(255,255,255,.45)">'+esc(vsLabel)+'. Sector median: '+b.avg+'.<' + '/div>';
  h+=score>=65?'<span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(26,158,107,.2);color:#6DDC9E">IPO eligible<' + '/span>':'<span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(192,57,43,.2);color:#F4A09A">'+(65-score)+' pts to SME threshold<' + '/span>';
  h+='<' + '/div>';
  h+='<div class="bm-insight-card"><div style="font-size:20px;margin-bottom:6px">📈<' + '/div><div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px">Above 80 = 3.2× IPO success probability<' + '/div>';
  h+=score>=80?'<div style="font-size:11px;color:rgba(255,255,255,.45)">In high-success zone. 8–25× oversubscription typical.<' + '/div><span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(26,158,107,.2);color:#6DDC9E">High-success zone ✓<' + '/span>':'<div style="font-size:11px;color:rgba(255,255,255,.45)">'+(80-score)+' points from high-success zone.<' + '/div><span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(232,138,46,.2);color:#F5A94E">'+(80-score)+' pts to high-success zone<' + '/span>';
  h+='<' + '/div><' + '/div><' + '/div>';
  return h;
}
function animateBenchmarkBar(){setTimeout(function(){var el=document.getElementById('bm-bar-fill');if(el)el.style.width=(window._bmBarPct||0)+'%';},150);}

/* ═══════════════════════════
   SIMULATOR
═══════════════════════════ */
var SIM_ITEMS=[
  {label:'Appoint Independent Directors',impact:6,sebi:'ICDR Reg 26(6)',timeline:'2–3 months',cost:'₹2–5L'},
  {label:'Appoint Woman Director',impact:4,sebi:'CA2013 §149(1)',timeline:'1 month',cost:'₹1–2L'},
  {label:'Improve EBITDA margin to 15%+',impact:5,sebi:'ICDR General',timeline:'6–9 months',cost:'Internal'},
  {label:'Resolve GST / TDS notices',impact:4,sebi:'ICDR Reg 26(1)',timeline:'1–2 months',cost:'₹1–3L'},
  {label:'Reduce D/E below 1x',impact:3,sebi:'ICDR General',timeline:'4–6 months',cost:'Varies'},
  {label:'File pending ROC documents',impact:3,sebi:'CA2013 §137',timeline:'2–4 weeks',cost:'₹50K–₹2L'},
  {label:'Constitute Audit Committee',impact:3,sebi:'LODR Reg 18',timeline:'1–2 months',cost:'₹50K'},
  {label:'Register Trademark / IP',impact:2,sebi:'ICDR Reg 32',timeline:'Apply now',cost:'₹20K–₹50K'},
];
function renderSimulator(score){
  function cv(s){return s>=78?'#1A9E6B':s>=65?'#C9932A':'#C0392B';}
  function vv(s){return s>=78?'Main Board Eligible &#127919;':s>=65?'SME IPO Eligible &#9989;':s>=50?'SME with gaps &#9888;':'Not IPO-ready &#10060;';}
  function tv(s){return s>=78?'6–12 months':s>=65?'9–15 months':s>=50?'12–18 months':'18–24 months';}
  var h='<div class="form-card" id="score-simulator" style="margin-top:4px"><div class="fsec-lbl">Score Simulator — What if I fix this?<' + '/div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">';
  h+='<div style="text-align:center;padding:14px;background:var(--card);border-radius:10px;border:1px solid var(--bd)"><div style="font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Current Score<' + '/div><div style="font-size:36px;font-weight:900;font-family:var(--serif);color:'+cv(score)+'">'+score+'<' + '/div><div style="font-size:12px;color:var(--mu);margin-top:2px">'+vv(score)+'<' + '/div><' + '/div>';
  h+='<div style="text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid var(--tl)"><div style="font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Potential Score<' + '/div><div id="sim-new-score" style="font-size:36px;font-weight:900;font-family:var(--serif);color:var(--tl)">'+score+'<' + '/div><div id="sim-new-verdict" style="font-size:12px;color:var(--mu);margin-top:2px">'+vv(score)+'<' + '/div><' + '/div>';
  h+='<' + '/div>';
  h+='<div id="sim-items" style="display:flex;flex-direction:column;gap:7px"><' + '/div>';
  h+='<div style="margin-top:12px;padding:11px 14px;background:rgba(13,92,107,.04);border:1px solid rgba(13,92,107,.12);border-radius:9px"><div style="font-size:11px;color:var(--mu);margin-bottom:2px">Estimated IPO Timeline<' + '/div><div id="sim-timeline" style="font-size:14px;font-weight:700;color:var(--tl)">'+tv(score)+'<' + '/div><' + '/div>';
  h+='<a href="https://wa.me/918851059588?text=Hi%20ipowork%2C%20I%20simulated%20my%20IPO%20score%20and%20want%20help." target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:12px;background:#25D366;color:#fff;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">📱 Help me achieve this score →<' + '/a>';
  h+='<' + '/div>';
  return h;
}
function initSimulator(score){
  var el=document.getElementById('sim-items');if(!el)return;
  function cv(s){return s>=78?'#1A9E6B':s>=65?'#C9932A':'#C0392B';}
  function vv(s){return s>=78?'Main Board Eligible':s>=65?'SME IPO Eligible':s>=50?'SME with gaps':'Not IPO-ready';}
  function tv(s){return s>=78?'6–12 months':s>=65?'9–15 months':s>=50?'12–18 months':'18–24 months';}
  el.innerHTML='';
  SIM_ITEMS.forEach(function(item){
    var row=document.createElement('div');row.className='sim-item-row';
    row.innerHTML='<input type="checkbox" data-impact="'+item.impact+'" style="width:16px;height:16px;accent-color:var(--tl);cursor:pointer;flex-shrink:0" onchange="updateSim('+score+',this.closest(\'.sim-item-row\'))">'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--sl)">'+item.label+'<' + '/div>'
      +'<div style="font-size:11px;color:var(--mu);margin-top:1px">'+item.sebi+' · '+item.timeline+' · '+item.cost+'<' + '/div><' + '/div>'
      +'<div style="font-size:14px;font-weight:800;color:var(--tl);flex-shrink:0">+'+item.impact+'<' + '/div>';
    el.appendChild(row);
  });
}
function updateSim(base,row){
  if(row)row.classList.toggle('checked',row.querySelector('input').checked);
  var total=base;
  document.querySelectorAll('#sim-items input:checked').forEach(function(c){total+=parseInt(c.dataset.impact||0);});
  total=Math.min(total,98);
  function cv(s){return s>=78?'#1A9E6B':s>=65?'#C9932A':'#C0392B';}
  function vv(s){return s>=78?'Main Board Eligible':s>=65?'SME IPO Eligible':s>=50?'SME with gaps':'Not IPO-ready';}
  function tv(s){return s>=78?'6–12 months':s>=65?'9–15 months':s>=50?'12–18 months':'18–24 months';}
  var ns=document.getElementById('sim-new-score'),nv=document.getElementById('sim-new-verdict'),tl=document.getElementById('sim-timeline');
  if(ns){ns.textContent=total;ns.style.color=cv(total);}
  if(nv)nv.textContent=vv(total);
  if(tl)tl.textContent=tv(total);
}

/* ═══════════════════════════
   FIX ENGINE
═══════════════════════════ */
var FIX_DATA=[
  {issue:'No Independent Directors',fix:'Appoint ≥2 IDs including 1 woman — SEBI ICDR 2018 Reg 26(6)',impact:6,expert:'Company Secretary',cost:'₹2–5L',timeline:'2–3 months',priority:'high'},
  {issue:'Pending ROC Filings',fix:'File AOC-4 and MGT-7 — CA2013 §137–138',impact:3,expert:'Company Secretary',cost:'₹50K–₹2L',timeline:'2–4 weeks',priority:'high'},
  {issue:'GST / TDS Mismatch',fix:'Reconcile GSTR-2B, clear outstanding notices',impact:4,expert:'CA / Tax Consultant',cost:'₹1–3L',timeline:'1–2 months',priority:'medium'},
  {issue:'High Debt-to-Equity',fix:'Pre-pay debt or convert to equity before DRHP',impact:3,expert:'CFO / Financial Advisor',cost:'Varies',timeline:'3–6 months',priority:'medium'},
  {issue:'Audit Committee Not Formed',fix:'Constitute AC with majority IDs — SEBI LODR Reg 18',impact:3,expert:'Company Secretary',cost:'₹50K',timeline:'1 month',priority:'medium'},
  {issue:'Trademark / IP Unregistered',fix:'File trademark application',impact:2,expert:'IP Lawyer',cost:'₹20K–₹50K',timeline:'Apply now',priority:'low'},
];
function renderFixEngine(){
  var h='<div class="form-card" style="margin-top:4px"><div class="fsec-lbl">Fix Engine — How to close each gap<' + '/div>';
  FIX_DATA.forEach(function(f){
    var pc=f.priority==='high'?'#C0392B':f.priority==='medium'?'#C9932A':'#6B8593';
    h+='<div class="fix-item" style="border-left-color:'+pc+'">'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px"><div style="font-size:14px;font-weight:700;color:var(--sl)">'+f.issue+'<' + '/div><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;color:'+pc+';border:1px solid '+pc+';white-space:nowrap;text-transform:uppercase;flex-shrink:0">'+f.priority+'<' + '/span><' + '/div>'
      +'<div style="font-size:13px;color:var(--mu);margin-bottom:8px;line-height:1.6">'+f.fix+'<' + '/div>'
      +'<div style="display:flex;gap:14px;font-size:12px;margin-bottom:10px;flex-wrap:wrap;color:var(--mu)"><span>👤 <strong style="color:var(--sl)">'+f.expert+'<' + '/strong><' + '/span><span>💰 '+f.cost+'<' + '/span><span>⏱ '+f.timeline+'<' + '/span><span style="color:var(--ok)">📈 +'+f.impact+' score<' + '/span><' + '/div>'
      +'<div style="display:flex;gap:8px"><a href="https://wa.me/918851059588?text=Hi%20ipowork%2C%20need%20help%20with%3A%20'+encodeURIComponent(f.issue)+'" target="_blank" style="padding:8px 14px;background:var(--tl);color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Find Expert →<' + '/a><a href="https://wa.me/918851059588?text=Hi%20ipowork%2C%20want%20to%20start%20fixing%3A%20'+encodeURIComponent(f.issue)+'" target="_blank" style="padding:8px 14px;background:var(--sf);color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">Start Now →<' + '/a><' + '/div>'
      +'<' + '/div>';
  });
  h+='<' + '/div>';
  return h;
}

/* ═══════════════════════════
   VALUATION
═══════════════════════════ */
var PEERS={
  'Manufacturing':[{name:'Praj Industries',rev:'1,240',em:'14.2',pe:'28',ev:'16',mc:'3,200'},{name:'Hind Rectifiers',rev:'380',em:'12.8',pe:'22',ev:'13',mc:'620'},{name:'Menon Pistons',rev:'290',em:'11.5',pe:'18',ev:'11',mc:'380'}],
  'Pharma':[{name:'Windlas Biotech',rev:'520',em:'16.2',pe:'24',ev:'14',mc:'980'},{name:'Marksans Pharma',rev:'1,100',em:'18.1',pe:'26',ev:'15',mc:'2,800'}],
  'IT Services':[{name:'Mastech Digital',rev:'680',em:'12.4',pe:'22',ev:'13',mc:'1,200'},{name:'Kellton Tech',rev:'540',em:'11.8',pe:'18',ev:'11',mc:'800'}],
  'Auto Components':[{name:'Sansera Engineering',rev:'2,400',em:'17.2',pe:'28',ev:'16',mc:'5,200'},{name:'JBM Auto',rev:'3,800',em:'13.4',pe:'22',ev:'13',mc:'6,400'}],
  'FMCG':[{name:'DFM Foods',rev:'790',em:'16.0',pe:'26',ev:'15',mc:'1,800'},{name:'Prataap Snacks',rev:'1,400',em:'12.5',pe:'22',ev:'13',mc:'2,400'}],
  'Chemicals':[{name:'Neogen Chemicals',rev:'620',em:'18.4',pe:'30',ev:'18',mc:'2,100'},{name:'Tatva Chintan',rev:'510',em:'21.2',pe:'34',ev:'20',mc:'2,900'}],
  'Financial Services':[{name:'SBFC Finance',rev:'1,200',em:'42.0',pe:'30',ev:'22',mc:'8,200'},{name:'Anand Rathi',rev:'890',em:'28.4',pe:'26',ev:'18',mc:'4,100'}],
  'Healthcare':[{name:'Akums Drugs',rev:'3,200',em:'14.2',pe:'24',ev:'14',mc:'5,800'},{name:'Swasth Foodtech',rev:'180',em:'12.0',pe:'18',ev:'11',mc:'420'}],
  'Other':[{name:'Senco Gold',rev:'4,100',em:'8.2',pe:'22',ev:'13',mc:'3,200'},{name:'Pyramid Technoplast',rev:'580',em:'10.4',pe:'18',ev:'11',mc:'820'}],
};
function renderValuation(sector, revenue, pat, ebitda, ebitdaM){
  var peers = PEERS[sector] || PEERS['Other'];

  // Convert any numeric format to Crores
  function toCr(s){
    if(s===null||s===undefined||s==='')return 0;
    var str=String(s).toLowerCase().trim();
    var n=parseFloat(str.replace(/[^0-9.-]/g,''))||0;
    if(n===0) return 0;
    if(str.indexOf('cr')>=0)     return n;
    if(/l(akh)?s?\b/.test(str))  return n/100;
    if(n>10000000) return n/10000000;   // absolute rupees
    if(n>10000)    return n/100;        // likely lakhs
    return n; // already Cr
  }

  var rev_n = toCr(revenue);
  var pat_n = toCr(pat);

  // ebitdaM must be a % between -100 and +100
  // if Probe42 returns absolute EBITDA as "margin" field, sanitize it
  var em_raw = 0;
  if(ebitdaM !== null && ebitdaM !== undefined && ebitdaM !== '') {
    var em_parsed = parseFloat(String(ebitdaM).replace(/[^0-9.-]/g,''))||0;
    // Valid margin is between -100% and +100%
    // If outside that range, it's an absolute value — recalculate from rev
    if(Math.abs(em_parsed) <= 100) {
      em_raw = em_parsed;
    } else if(rev_n > 0) {
      // em_parsed is absolute EBITDA in same units as revenue
      var em_abs = toCr(ebitdaM);
      em_raw = (em_abs / rev_n) * 100;
      if(Math.abs(em_raw) > 100) em_raw = 0; // still bad, discard
    }
  }
  var em_n = em_raw > 0 ? em_raw : 0;

  // Have real data?
  var hasRevenue = rev_n > 0;
  var hasPAT     = pat_n > 0;
  var hasEBITDA  = em_n  > 0;
  var isLoss     = em_raw < -0.1; // genuinely loss-making
  var hasAnyData = hasRevenue || hasPAT;

  var avgPE = peers.reduce(function(s,p){return s+(parseFloat(p.pe)||0);},0)/peers.length;
  var avgEV = peers.reduce(function(s,p){return s+(parseFloat(p.ev)||0);},0)/peers.length;
  var avgPS = peers.reduce(function(s,p){
    var mc=parseFloat(p.mc)||0,rv=parseFloat(p.rev)||1;return s+(mc/rv);
  },0)/peers.length;

  var valMethod='', valL=0, valB=0, valH=0, hasVal=false;
  if(hasPAT){
    valMethod='P/E '+avgPE.toFixed(0)+'x';
    valL=Math.round(pat_n*avgPE*0.6);
    valB=Math.round(pat_n*avgPE*0.8);
    valH=Math.round(pat_n*avgPE);
    hasVal=(valB>0);
  } else if(hasRevenue&&hasEBITDA){
    var eb=rev_n*em_n/100;
    valMethod='EV/EBITDA '+avgEV.toFixed(0)+'x';
    valL=Math.round(eb*avgEV*0.6);
    valB=Math.round(eb*avgEV*0.8);
    valH=Math.round(eb*avgEV);
    hasVal=(valB>0);
  } else if(hasRevenue){
    valMethod='P/Sales '+avgPS.toFixed(1)+'x';
    valL=Math.round(rev_n*avgPS*0.5);
    valB=Math.round(rev_n*avgPS*0.7);
    valH=Math.round(rev_n*avgPS);
    hasVal=(valB>0);
  }

  function fmtC(n){return n>0?'\u20b9'+n.toLocaleString('en-IN')+' Cr':'N/A';}

  var h='<div class="fin-card" style="margin-top:4px">';
  h+='<div class="card-hd"><div class="card-ttl">Valuation Matrix &mdash; '+esc(sector)+' Sector Peers</div>';
  h+='<div class="card-sub">Sector benchmarks &middot; FY2024 &middot; indicative only</div></div>';

  // Peer table — always shown
  h+='<div style="overflow-x:auto"><table class="fin-tbl" style="min-width:480px">';
  h+='<thead><tr><th>Company</th><th>Revenue (\u20b9Cr)</th><th>EBITDA%</th><th>P/E</th><th>EV/EBITDA</th><th>Mkt Cap (\u20b9Cr)</th></tr></thead><tbody>';
  peers.forEach(function(p){
    h+='<tr><td style="font-weight:600">'+esc(p.name)+'</td><td>'+esc(p.rev)+'</td>'
      +'<td style="color:var(--ok)">'+esc(p.em)+'%</td><td>'+esc(p.pe)+'x</td>'
      +'<td>'+esc(p.ev)+'x</td><td>'+esc(p.mc)+'</td></tr>';
  });

  // Your company row — only show if we have real data
  if(hasAnyData){
    var revD=hasRevenue?'\u20b9'+rev_n.toFixed(0)+' Cr':'—';
    var emD=em_raw!==0?em_raw.toFixed(1)+'%':'—';
    var valD=hasVal?'\u20b9'+valB.toLocaleString('en-IN')+' Cr est.':'TBD';
    var emC=em_raw<0?'var(--er)':em_raw>0?'var(--ok)':'var(--mu)';
    h+='<tr style="background:rgba(13,92,107,.05);border-top:2px solid var(--tl);font-weight:700">'
      +'<td style="color:var(--tl)">\u2605 Your Company</td>'
      +'<td>'+revD+'</td><td style="color:'+emC+'">'+emD+'</td>'
      +'<td style="color:var(--mu)">?</td><td style="color:var(--mu)">?</td>'
      +'<td style="color:var(--tl)">'+valD+'</td></tr>';
  }
  h+='</tbody></table></div>';

  // Valuation ranges
  if(hasVal){
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:14px 0 8px">';
    [{lbl:'Conservative',v:valL,note:'0.6x',hi:false},
     {lbl:'Base Case',v:valB,note:'0.8x',hi:true},
     {lbl:'Optimistic',v:valH,note:'1.0x',hi:false}
    ].forEach(function(c){
      var bg=c.hi?'rgba(13,92,107,.08)':'rgba(13,92,107,.04)';
      var bd=c.hi?'1.5px solid var(--tl)':'1px solid var(--bd)';
      var tc=c.hi?'var(--tl)':'var(--sl)';
      h+='<div style="text-align:center;padding:12px;background:'+bg+';border-radius:9px;border:'+bd+'">'
        +'<div style="font-size:10px;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">'+c.lbl+'</div>'
        +'<div style="font-size:18px;font-weight:900;color:'+tc+';font-family:var(--serif)">'+fmtC(c.v)+'</div>'
        +'<div style="font-size:10px;color:var(--mu);margin-top:2px">'+c.note+' &middot; '+valMethod+'</div>'
        +'</div>';
    });
    h+='</div>';
  } else if(hasAnyData&&isLoss){
    h+='<div style="padding:10px 14px;background:rgba(232,138,46,.06);border:1px solid rgba(232,138,46,.2);border-radius:8px;margin:10px 0;font-size:12px;color:var(--go)">'
      +'<strong>Loss-making company.</strong> P/E and EV/EBITDA methods not applicable. '
      +'Merchant banker will use DCF or asset-based valuation at DRHP filing.</div>';
  } else {
    h+='<div style="padding:10px 14px;background:rgba(13,92,107,.04);border:1px solid var(--bd);border-radius:8px;margin:10px 0;font-size:12px;color:var(--mu)">'
      +'Sector peer benchmarks shown above. Add company financials in the Intelligence tab for a valuation estimate.</div>';
  }

  h+='<div style="font-size:11px;color:var(--mu);margin-top:4px">\u26a0 Indicative only. Not investment advice. Final valuation by SEBI-registered merchant banker.</div>';
  h+='</div>';
  return h;
}




/* ═══════════════════════════
   FREE TIER RUN
═══════════════════════════ */


/* ── Report helper functions ── */
function xe(s){ return String(s||'').replace(/&/g,'&amp;').replace(/<' + '/g,'&lt;').replace(/>/g,'&gt;'); }

function dualScoreBanner(score, vdict, col, company, sector, exchange, dims){
  var s = score||0;
  var grade = s>=78?'IPO READY':s>=65?'NEEDS WORK':s>=50?'CAUTIOUS':'NOT READY';
  var html = '<div style="display:flex;align-items:center;gap:16px;padding:18px 20px;'
    + 'background:linear-gradient(135deg,#08404D,#0D5C6B);border-radius:12px;margin-bottom:18px;color:#fff">'
    + '<div style="font-size:52px;font-weight:900;font-family:Georgia,serif;color:'+col+';line-height:1">'+s+'</div>'
    + '<div style="flex:1">'
    + '<div style="font-size:18px;font-weight:800;margin-bottom:2px">'+xe(company)+'</div>'
    + '<div style="font-size:11px;opacity:.6">'+xe(sector)+' &middot; '+xe(exchange)+'</div>'
    + '<div style="margin-top:8px;font-size:13px;font-weight:700;color:'+col+'">'+grade+'</div>'
    + '</div>';
  if(dims){
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;min-width:180px">';
    ['financial','governance','compliance','promoter','legal','readiness'].forEach(function(k){
      var v2=dims[k]||0;
      var c2=v2>=78?'#1A9E6B':v2>=65?'#E88A2E':'#C0392B';
      html += '<div style="background:rgba(255,255,255,.1);border-radius:6px;padding:6px 8px;text-align:center">'
        + '<div style="font-size:15px;font-weight:800;color:'+c2+'">'+v2+'</div>'
        + '<div style="font-size:8px;opacity:.6;text-transform:uppercase;letter-spacing:.4px">'+k+'</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function section(title, sub){
  return '<div class="sec-head" style="margin:18px 0 8px;padding:10px 14px;'
    + 'background:rgba(13,92,107,.07);border-left:4px solid #0D5C6B;border-radius:0 8px 8px 0">'
    + '<div style="font-size:13px;font-weight:800;color:#08404D">'+title+'</div>'
    + (sub?'<div style="font-size:11px;color:#6B8A94;margin-top:2px">'+sub+'</div>':'')
    + '</div>';
}

function kv(label, value, note){
  var val = value||'—';
  return '<div style="display:flex;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px solid #F0F6F8">'
    + '<div style="font-size:11px;color:#6B8A94;min-width:120px">'+label+'</div>'
    + '<div style="font-size:12px;font-weight:700;color:#1A2E35;flex:1">'+val+'</div>'
    + (note?'<div style="font-size:10px;color:#9AB0B8">'+note+'</div>':'')
    + '</div>';
}


function md2html(raw){
  if(!raw) return '';
  var t=String(raw);
  // Escape HTML
  t=t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Process tables FIRST before any line transformations
  var tableResult=[],lines=t.split('\n'),i=0;
  while(i<lines.length){
    var ln=lines[i];
    // Detect table row: has | and at least 2 cells
    if(/^\s*\|/.test(ln)||(/\|/.test(ln)&&ln.split('|').length>=3)){
      var tblLines=[];
      while(i<lines.length&&(lines[i].indexOf('|')>-1)){
        tblLines.push(lines[i]);i++;
      }
      // Parse table
      var rows=[];
      var isHeader=false;
      for(var j=0;j<tblLines.length;j++){
        var cells=tblLines[j].replace(/^\|/,'').replace(/\|$/,'').split('|').map(function(c){return c.trim();});
        var isSep=cells.every(function(c){return /^[-:=\s]+$/.test(c);}); 
        if(!isSep) rows.push({cells:cells,header:j===0||(rows.length===0)});
        else if(rows.length>0) rows[0].header=true;
      }
      if(rows.length>0){
        var tbl='<table style="width:100%;border-collapse:collapse;font-size:12px;margin:12px 0">';
        var hdone=false;
        rows.forEach(function(r,ri){
          if(r.header&&!hdone){
            tbl+='<thead><tr style="background:#F0F5FB">';
            r.cells.forEach(function(c){tbl+='<th style="padding:7px 10px;text-align:left;border-bottom:2px solid #C8DCF0;font-weight:700;color:#1A2E35">'+_mdinline(c)+'</th>';});
            tbl+='</tr></thead><tbody>';hdone=true;
          } else {
            var bg=ri%2===0?'#fff':'#F8FBFC';
            tbl+='<tr style="background:'+bg+';border-bottom:1px solid #EEF2F5">';
            r.cells.forEach(function(c){
              var style='padding:7px 10px;color:#1A2E35;vertical-align:top';
              if(c.indexOf('✅')>=0||c.indexOf('✓')>=0) style+=';color:#1A6B3A;font-weight:600';
              if(c.indexOf('⚠️')>=0||c.indexOf('CRITICAL')>=0||c.indexOf('HIGH')>=0) style+=';color:#C0392B;font-weight:600';
              tbl+='<td style="'+style+'">'+_mdinline(c)+'</td>';
            });
            tbl+='</tr>';
          }
        });
        if(!hdone) tbl+='<tbody>';
        tbl+='</tbody></table>';
        tableResult.push(tbl);
      }
    } else {
      tableResult.push(ln);i++;
    }
  }
  t=tableResult.join('\n');
  // Inline formatting
  t=_mdinline(t);
  // Process line by line for structure
  var outLines=t.split('\n'),result=[],inList=false,inOList=false;
  for(var k=0;k<outLines.length;k++){
    var l=outLines[k];
    var isBullet=/^[-*•] /.test(l.trim());
    var isOList=/^\d+[\.\)] /.test(l.trim());
    var isH5=/^##### /.test(l);
    var isH4=/^#### /.test(l);
    var isH3=/^### /.test(l);
    var isH2=/^## /.test(l);
    var isH1=/^# /.test(l);
    var isHr=/^---+$/.test(l.trim());
    var isBlock=/^&gt; /.test(l);
    if((inList&&!isBullet)||(inOList&&!isOList)){
      result.push(inList?'</ul>':'</ol>');inList=false;inOList=false;
    }
    if(isH1) result.push('<h4 style="font-size:15px;font-weight:800;color:#08404D;margin:16px 0 8px;border-bottom:2px solid #1A5C8A;padding-bottom:6px">'+l.replace(/^# /,'')+'</h4>');
    else if(isH2) result.push('<h4 style="font-size:14px;font-weight:800;color:#08404D;margin:14px 0 7px;border-bottom:1px solid #D0E4F0;padding-bottom:5px">'+l.replace(/^## /,'')+'</h4>');
    else if(isH3) result.push('<h5 style="font-size:13px;font-weight:700;color:#1A5C8A;margin:12px 0 6px">'+l.replace(/^### /,'')+'</h5>');
    else if(isH4||isH5) result.push('<h6 style="font-size:12px;font-weight:700;color:#2C5364;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.3px">'+l.replace(/^#{4,6} /,'')+'</h6>');
    else if(isHr) result.push('<hr style="border:none;border-top:1px solid #E0EAF0;margin:12px 0">');
    else if(isBlock) result.push('<blockquote style="border-left:3px solid #1A5C8A;margin:8px 0;padding:6px 12px;background:#F5F8FB;font-size:12px;color:#444">'+l.replace(/^&gt; /,'')+'</blockquote>');
    else if(isBullet){
      if(!inList){result.push('<ul style="margin:6px 0;padding-left:18px;font-size:13px;line-height:1.8">');inList=true;}
      result.push('<li style="margin:2px 0">'+l.trim().replace(/^[-*•] /,'')+'</li>');
    }
    else if(isOList){
      if(!inOList){result.push('<ol style="margin:6px 0;padding-left:18px;font-size:13px;line-height:1.8">');inOList=true;}
      result.push('<li style="margin:2px 0">'+l.trim().replace(/^\d+[\.\)] /,'')+'</li>');
    }
    else if(l.indexOf('<table')>=0||l.indexOf('</table')>=0||l.indexOf('<tr')>=0||l.indexOf('<td')>=0||l.indexOf('<th')>=0||l.indexOf('<thead')>=0||l.indexOf('<tbody')>=0) result.push(l);
    else if(l.trim()==='') result.push('');
    else result.push('<p style="margin:5px 0;font-size:13px;line-height:1.75;color:#1A2E35">'+l+'</p>');
  }
  if(inList) result.push('</ul>');
  if(inOList) result.push('</ol>');
  // Clean empty <p> tags
  return result.join('\n').replace(/<p[^>]*>\s*<\/p>/g,'').replace(/\n{3,}/g,'\n\n');
}
function _mdinline(s){
  return s
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code style="background:#F0F5FB;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:11px">$1</code>');
}

function buildReportHTML(tier) {
  var stored = AIRA_RESULTS[tier];
  if (!stored) {
    var keys = Object.keys(AIRA_RESULTS);
    if (!keys.length) return null;
    stored = AIRA_RESULTS[keys[keys.length-1]];
  }
  if (!stored) return null;
  var result = stored.result || stored;
  var cname = stored.cname || result.company_name || 'Company';
  var sector = stored.sector || '';
  var score = result.score || 0;
  var col = score>=78?'#1A9E6B':score>=65?'#E88A2E':'#C0392B';
  var report = result._report || result.report_text || result.report || '';
  var htm = '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>AIRA — '+xe(cname)+'</' + 'title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}'
    +'html,body{height:auto!important;overflow:visible!important;font-family:-apple-system,sans-serif;font-size:12px;color:#1A2E35;background:#fff}'
    +'@page{size:A4;margin:10mm 12mm}'
    +'.page{max-width:900px;margin:0 auto;padding:24px}'
    +'.hero{background:linear-gradient(135deg,#08404D,#0D5C6B);color:#fff;padding:20px 24px;border-radius:10px;margin-bottom:18px;display:flex;align-items:center;gap:18px}'
    +'.sc{font-size:48px;font-weight:900;font-family:Georgia,serif;color:'+col+';line-height:1}'
    +'h1{font-size:14px;font-weight:800;color:#08404D;margin:16px 0 5px;padding:8px 12px;background:#EEF9FB;border-left:4px solid #0D5C6B;border-radius:0 6px 6px 0}'
    +'h2{font-size:13px;font-weight:700;color:#0D5C6B;margin:12px 0 4px;padding:5px 10px;background:rgba(13,92,107,.06);border-radius:4px}'
    +'h3{font-size:12px;font-weight:700;color:#08404D;margin:10px 0 4px;border-bottom:1px solid #E0EEF0;padding-bottom:3px}'
    +'p{margin-bottom:7px}ul{padding-left:16px;margin-bottom:7px}li{margin-bottom:3px}'
    +'strong{color:#08404D;font-weight:700}'
    +'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}'
    +'th{background:#08404D;color:#fff;padding:6px 10px;text-align:left;font-size:10px}'
    +'td{padding:5px 10px;border:1px solid #E0EEF0}'
    +'tr:nth-child(even) td{background:#F8FCFD}'
    +'blockquote{background:#FDF6E8;border-left:4px solid #E88A2E;padding:8px 12px;margin:8px 0}'
    +'@media print{html,body{height:auto!important;overflow:visible!important}}</' + 'style>'
    +'</' + 'head><body><div class="page">'
    +'<div class="hero"><div class="sc">'+score+'</div>'
    +'<div><div style="font-size:20px;font-weight:900;margin-bottom:3px">'+xe(cname)+'</div>'
    +'<div style="opacity:.6;font-size:11px">'+xe(sector)+' &middot; AIRA IPO Readiness &middot; '+new Date().toLocaleDateString('en-IN')+'</div></div></div>'
    +'<div>'+md2html(report)+'</div>'
    +'<div style="margin-top:16px;padding-top:10px;border-top:1px solid #E0EEF0;font-size:10px;color:#9AB0B8;display:flex;justify-content:space-between">'
    +'<span>ipowork.com &middot; AI IPO Readiness Platform</span><span>Not investment advice</span></div>'
    +'</div></' + 'body></' + 'html>';
  return {htm:htm, company:cname, score:score};
}


/* ── Utility functions for renderAIRAReport ── */
function rgba(hex, a){
  if(typeof hex==='string'&&hex.startsWith('#')){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  return hex;
}

function previewReport(tier){
  var r = buildReportHTML(tier);
  if(!r){ alert('Run analysis first to generate a report.'); return; }
  var toolbar = '<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#08404D;padding:10px 20px;display:flex;align-items:center;gap:12px;font-family:sans-serif">'
    +'<span style="font-size:16px;font-weight:900;color:#fff;font-family:Georgia,serif">ipowork<sup style="font-size:9px;color:#E88A2E">AI</sup></span>'
    +'<span style="flex:1;font-size:11px;color:rgba(255,255,255,.5)">'+xe(r.company)+(r.score?' &middot; Score: '+r.score+'/100':'')+'</span>'
    +'<button onclick="window.print()" style="padding:7px 18px;background:#E88A2E;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">🖨 Print / Save PDF</button>'
    +'<button onclick="window.close()" style="padding:7px 12px;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:6px;font-size:12px;cursor:pointer">Close</button>'
    +'</div><div style="height:52px"></div>'
    +'<style>@media print{div[style*="position:fixed"]{display:none!important}html,body{height:auto!important;overflow:visible!important}}</' + 'style>';
  var fullHtml = r.htm.replace('<body>', '<body>'+toolbar);
  var blob = new Blob([fullHtml], {type:'text/html;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.target='_blank'; a.rel='noopener';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 5000);
}

function downloadReport(tier){
  var r = buildReportHTML(tier);
  if(!r){ alert('Run analysis first.'); return; }
  var blob = new Blob([r.htm], {type:'text/html;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url;
  a.download='AIRA-'+(r.company||'Report').replace(/[^a-zA-Z0-9]/g,'-')+'.html';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 3000);
}

function renderAIRAReport(result, cname, sector, exchange, out, tier) {
  if(!out) return;
  AIRA_RESULTS[tier]={result:result,cname:cname,sector:sector,exchange:exchange,tier:tier};
    saveReportToStore(tier, cname, sector, result);

  var report  = result._report || result.report || '';
  var score   = result.score || 0;
  if(!score){ var sM=report.match(/AIRA Score:\s*(\d+)/i); score=sM?Math.min(99,Math.max(1,parseInt(sM[1]))):65; }
  var v=vd(score), col=sc(score);

  var dims={financial:0,governance:0,compliance:0,promoter:0,legal:0,readiness:0};
  var jm=report.match(/---JSON---\s*([\s\S]*?)---END---/);
  if(jm){try{var d2=JSON.parse(jm[1].trim());Object.keys(dims).forEach(function(k){if(d2[k])dims[k]=d2[k];});if(d2.company_name&&!company)company=d2.company_name;}catch(e){}}

  var clean=report.replace(/AIRA Score:\s*\d+\n?/gi,'')
    .replace(/---JSON---[\s\S]*?---END---/g,'')
    .replace(/---DIMS---[\s\S]*?---DIMS---/g,'')
    .replace(/---VALUATION_JSON_START---[\s\S]*?---VALUATION_JSON_END---/g,'')
    .replace(/RESEARCH_JSON_START[\s\S]*?RESEARCH_JSON_END/g,'')
    .replace(/REPORT_START\s*/,'').replace(/\s*REPORT_END/,'')
    .replace(/```json[\s\S]*?```/g,'').replace(/```[\s\S]*?```/g,'')
    .trim();

  // Use best available company name - prefer Probe42 over Claude's JSON
  var company = cname||result.company_name||result.cin||'';
  // If company looks like a CIN (starts with letter+digits), try to get real name
  if(company && /^[ULu][0-9]{5}/.test(company)){
    var stored = AIRA_RESULTS[tier];
    if(stored && stored.cname && !/^[ULu][0-9]{5}/.test(stored.cname)){
      company = stored.cname;
    }
  }
  var tierLabel={paid:'Intelligence',doc:'AIRA Score',mainboard:'Mainboard',ca:'CA/CS Bundle',
    clearchit:'Clean Chit',ddbundle:'DD Bundle',free:'Free Analysis'}[tier]||tier;

  // ── Helper formatters ───────────────────────────────────────────────────
  function fmtINR(v){
    if(v==null||v===''||v===undefined)return'\u2014';
    var n=parseFloat(String(v).replace(/[^\d.-]/g,''));
    if(isNaN(n))return String(v);
    if(n>=10000000)return'\u20B9'+(n/10000000).toFixed(1)+' Cr';
    if(n>=100000)return'\u20B9'+(n/100000).toFixed(1)+' L';
    if(n>=1000)return'\u20B9'+(n/1000).toFixed(0)+' K';
    return'\u20B9'+n.toFixed(0);
  }
  function fmtPct(v){return(v!=null&&v!==''&&!isNaN(parseFloat(v)))?parseFloat(v).toFixed(1)+'%':'\u2014';}
  function fmtN(v){return(v!=null&&v!==''&&v!=='null')?String(v):'\u2014';}
  function fmtRatio(v,dec){return(v!=null&&!isNaN(parseFloat(v)))?parseFloat(v).toFixed(dec||2)+'x':'\u2014';}
  function fmtDays(v){return(v!=null&&!isNaN(parseFloat(v)))?Math.round(parseFloat(v))+' d':'\u2014';}
  function okBad(v,goodFn){var s=String(v||'');if(!s||s==='\u2014')return'';return goodFn(v)?'v-ok':'v-bad';}

  // Probe42 fields
  var fin2  = result.financials   || {};
  var com2  = result.compliance   || {};
  var prom2 = result.promoters    || {};
  var dirs2 = Array.isArray(result.directors)       ? result.directors       : [];
  var chgs2 = Array.isArray(result.charges)         ? result.charges         : [];
  var peers2= Array.isArray(result.peer_comparison) ? result.peer_comparison : [];
  var cr2   = Array.isArray(result.credit_ratings)  ? result.credit_ratings  : [];
  var activeDirs = dirs2.filter(function(d){return !d.cessation;});

  var html='<div class="result-wrap">';

  // ── 1. Dual-score header ───────────────────────────────────────────────
  html += dualScoreBanner(score, v, col, company, sector, exchange, dims, null);

  // ── 2. Source + action row ─────────────────────────────────────────────
  if(result._source==='probe42_sandbox'){
    html+='<div style="padding:8px 14px;background:rgba(26,158,107,.08);border:1px solid rgba(26,158,107,.2);border-radius:8px;margin-bottom:12px;font-size:12px;font-weight:700;color:var(--ok)">&#9679; Probe42 Verified \u2014 '+esc(company)+'<' + '/div>';
  }
  html+='<div class="dl-row">'
    +'<button class="dl-btn-filled" style="background:var(--tl)" onclick="previewReport(\''+tier+'\')">Preview Report<' + '/button>'
    +'<button class="dl-btn-outline" onclick="downloadReport(\''+tier+'\')">Download PDF<' + '/button>'
    +'<' + '/div>';

  // ── 3. MCA Company Master ──────────────────────────────────────────────
  if(result.company_name || result.date_of_incorporation || result.status){
    html+='<div class="ds-card">';
    html+='<div class="ds-hd"><div class="ds-name">MCA Master<' + '/div><span class="ds-badge ds-live">VERIFIED<' + '/span><' + '/div>';
    html+='<div class="ds-rows">';
    var masterFields=[
      ['Status',       fmtN(result.status)],
      ['Compliance',   fmtN(result.active_compliance)],
      ['Incorporated', fmtN(result.date_of_incorporation)],
      ['Type',         fmtN(result.company_type)],
      ['Paid-up Capital', (function(v){if(!v)return null;var n=parseFloat(v);if(isNaN(n))return null;if(n>=10000000)return '\u20b9'+(n/10000000).toFixed(2)+' Cr';if(n>=100000)return '\u20b9'+(n/100000).toFixed(1)+' L';return '\u20b9'+n.toLocaleString('en-IN');})(result.paid_up_capital)],
      ['Auth Capital', (function(v){if(!v)return null;var n=parseFloat(v);if(isNaN(n))return null;if(n>=10000000)return '\u20b9'+(n/10000000).toFixed(2)+' Cr';if(n>=100000)return '\u20b9'+(n/100000).toFixed(1)+' L';return '\u20b9'+n.toLocaleString('en-IN');})(result.authorised_capital)],
      ['State',        fmtN(result.registered_state)],
      ['Last AGM',     fmtN(result.last_agm_date)],
      ['Last Filing',  fmtN(result.last_filing_date)],
      ['CIRP',         fmtN(result.cirp_status||'None')],
    ];
    masterFields.forEach(function(f){
      if(f[1]&&f[1]!=='\u2014')
        html+='<div class="ds-row"><span class="k">'+f[0]+'<' + '/span><span class="v">'+esc(String(f[1]))+'<' + '/span><' + '/div>';
    });
    if(result.website) html+='<div class="ds-row"><span class="k">Website<' + '/span><span class="v"><a href="https://'+esc(result.website)+'" target="_blank" style="color:var(--tl)">'+esc(result.website)+'<' + '/a><' + '/span><' + '/div>';
    html+='<' + '/div><' + '/div>';
  }

  // ── 4. Compliance card ─────────────────────────────────────────────────
  if(com2.gst_status||com2.roc_filing_status){
    html+='<div class="ds-card">';
    html+='<div class="ds-hd"><div class="ds-name">Compliance<' + '/div><span class="ds-badge ds-live">PROBE42<' + '/span><' + '/div>';
    html+='<div class="ds-rows">';
    [['GST Status',fmtN(com2.gst_status)],
     ['GST Registrations',fmtN(com2.gst_count)],
     ['EPFO',com2.epfo_registered?'Registered ('+com2.epfo_count+' estbl.)':'Not found'],
     ['ROC Filings',fmtN(com2.roc_filing_status)],
     ['MSME Delays',fmtN(com2.msme_delays||0)],
     ['Defaulter List',com2.defaulter?'\u26a0\ufe0f YES':'No'],
     ['Promoter Holding',fmtPct(prom2.promoter_holding_pct||'')],
    ].forEach(function(f){
      if(f[1]&&f[1]!=='\u2014')
        html+='<div class="ds-row"><span class="k">'+f[0]+'<' + '/span><span class="v '+(f[0]==='Defaulter List'&&com2.defaulter?'v-bad':'')+'">'+esc(String(f[1]))+'<' + '/span><' + '/div>';
    });
    html+='<' + '/div><' + '/div>';
  }

  // ── 5. Financials KPI grid ─────────────────────────────────────────────
  if(fin2.revenue_fy24||fin2.pat_fy24||fin2.net_worth){
    html+='<div class="sec-hd">Verified Financials \u2014 Probe42 ('+fmtN(fin2.fy_year)+')<' + '/div>';
    html+='<div class="kv-grid">';
    var kpData=[
      {l:'Revenue',v:fmtINR(fin2.revenue_fy24),g:true},
      {l:'PAT',v:fmtINR(fin2.pat_fy24),g:parseFloat(fin2.pat_fy24||0)>0},
      {l:'EBITDA Margin',v:fmtPct(fin2.ebitda_margin),g:parseFloat(fin2.ebitda_margin||0)>=12},
      {l:'Net Margin',v:fmtPct(fin2.net_margin),g:parseFloat(fin2.net_margin||0)>=8},
      {l:'Net Worth',v:fmtINR(fin2.net_worth),g:true},
      {l:'Total Assets',v:fmtINR(fin2.total_assets),g:true},
      {l:'D/E Ratio',v:fmtRatio(fin2.debt_equity_ratio),g:parseFloat(fin2.debt_equity_ratio||99)<=1.5},
      {l:'Current Ratio',v:fmtRatio(fin2.current_ratio),g:parseFloat(fin2.current_ratio||0)>=1.5},
      {l:'ROE',v:fmtPct(fin2.roe),g:parseFloat(fin2.roe||0)>=15},
      {l:'ROCE',v:fmtPct(fin2.roce),g:parseFloat(fin2.roce||0)>=15},
      {l:'Revenue Growth',v:fmtPct(fin2.revenue_growth),g:parseFloat(fin2.revenue_growth||0)>=10},
      {l:'Interest Coverage',v:fmtRatio(fin2.interest_coverage,1),g:parseFloat(fin2.interest_coverage||0)>=3},
      {l:'Inventory Days',v:fmtDays(fin2.inventory_days),g:true},
      {l:'Debtor Days',v:fmtDays(fin2.debtor_days),g:true},
      {l:'Auditor',v:fmtN(fin2.auditor),g:true},
      {l:'Filing Std',v:fmtN(fin2.filing_standard),g:true},
    ];
    kpData.forEach(function(k){
      if(!k.v||k.v==='\u2014')return;
      html+='<div class="kv-card"><div class="kv-val '+(k.g?'g':'a')+'">'+esc(String(k.v))+'<' + '/div><div class="kv-lbl">'+k.l+'<' + '/div><' + '/div>';
    });
    html+='<' + '/div>';

    // Credit ratings
    // Deduplicate ratings client-side (safety net)
    var crDedup=(function(){
      var seen={},out=[];
      (cr2||[]).forEach(function(r){
        var key=(r.agency||'')+'|'+(r.instrument||'');
        if(!seen[key]){seen[key]=true;out.push(r);}
      });
      return out.slice(0,6);
    })();
    if(crDedup.length){
      html+='<div style="padding:10px 14px;background:rgba(13,92,107,.04);border:1px solid rgba(13,92,107,.1);border-radius:9px;margin:10px 0">';
      html+='<div style="font-size:11px;font-weight:700;color:var(--tl);margin-bottom:6px">Credit Ratings<' + '/div>';
      html+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
      crDedup.forEach(function(r){
        var rc=r.rating&&r.rating.startsWith('A')?'var(--ok)':r.rating&&r.rating.startsWith('B')?'var(--wn)':'var(--mu)';
        html+='<div style="padding:6px 12px;background:#fff;border-radius:7px;border:1px solid var(--bd);font-size:12px">'
          +'<span style="color:var(--mu);font-size:10px">'+esc(r.agency)+'<' + '/span> '
          +'<span style="font-weight:800;color:'+rc+'">'+esc(r.rating)+'<' + '/span>'
          +(r.instrument?'<span style="font-size:10px;color:var(--mu)"> · '+esc(r.instrument)+'<' + '/span>':'')
          +(r.outlook&&r.outlook!=='Withdrawn'?'<span style="font-size:10px;color:var(--mu)"> ('+esc(r.outlook)+')<' + '/span>':'')
          +'<' + '/div>';
      });
      html+='<' + '/div><' + '/div>';
    }
  }

  // ── 6. Dimension scores ────────────────────────────────────────────────
  if(Object.values(dims).some(function(v){return v>0;})){
    html+='<div class="sec-hd">Dimension Scores<' + '/div><div class="dim-grid">';
    Object.keys(dims).forEach(function(k){
      var dv=dims[k]; if(!dv) return;
      var dc=sc(dv);
      html+='<div class="dim-card" style="border-top-color:'+dc+'">'
        +'<div class="dim-lbl">'+dimIcon(k)+' '+dimLabel(k)+'<' + '/div>'
        +'<div class="dim-val" style="color:'+dc+'">'+dv+'<' + '/div>'
        +'<div class="dim-bar-bg"><div class="dim-bar" style="width:'+dv+'%;background:'+dc+'"><' + '/div><' + '/div>'
        +'<div class="dim-verd">'+dimVerd(dv)+'<' + '/div><' + '/div>';
    });
    html+='<' + '/div>';
  }

  // ── 7. Directors table ─────────────────────────────────────────────────
  if(dirs2.length){
    html+='<div class="sec-hd">Board of Directors \u2014 Probe42 ('+dirs2.length+' total, '+activeDirs.length+' active)<' + '/div>';
    html+='<div class="dir-wrap"><div style="font-size:11px;color:var(--mu);margin-bottom:6px">Source: Probe42 authorized_signatories<' + '/div>';
    html+='<table class="dtable"><thead><tr><th>Name<' + '/th><th>DIN<' + '/th><th>Designation<' + '/th><th>Gender<' + '/th><th>Status<' + '/th><th>Appointed<' + '/th><' + '/tr><' + '/thead><tbody>';
    dirs2.forEach(function(d){
      var act=!d.cessation;
      html+='<tr>'
        +'<td style="font-weight:600">'+esc(d.name||'N/A')+'<' + '/td>'
        +'<td><span class="din-tag">'+esc(d.din||'N/A')+'<' + '/span><' + '/td>'
        +'<td>'+esc(d.designation||'Director')+'<' + '/td>'
        +'<td>'+esc(d.gender||'\u2014')+'<' + '/td>'
        +'<td style="color:'+(act?'var(--ok)':'var(--mu)')+'">&#9679; '+(act?'Active':'Ceased')+'<' + '/td>'
        +'<td>'+esc(d.appointed||'\u2014')+'<' + '/td><' + '/tr>';
    });
    html+='<' + '/tbody><' + '/table><' + '/div>';
  }

  // ── 8. Charges table ──────────────────────────────────────────────────
  if(chgs2.length){
    html+='<div class="sec-hd">Charges &amp; Liens \u2014 Probe42 ('+chgs2.length+' open)<' + '/div>';
    html+='<table class="fin-tbl"><thead><tr><th>Holder<' + '/th><th>Amount<' + '/th><th>Type<' + '/th><th>Status<' + '/th><th>Date<' + '/th><' + '/tr><' + '/thead><tbody>';
    chgs2.forEach(function(c){
      html+='<tr><td>'+esc(c.holder||'N/A')+'<' + '/td><td>'+esc(fmtINR(c.amount))+'<' + '/td>'
        +'<td>'+esc(c.type||'N/A')+'<' + '/td>'
        +'<td style="color:var(--wn);font-weight:600">'+esc(c.status||'Open')+'<' + '/td>'
        +'<td>'+esc(c.date||'N/A')+'<' + '/td><' + '/tr>';
    });
    html+='<' + '/tbody><' + '/table>';
  }

  // ── 9. Peer comparison ────────────────────────────────────────────────
  var validPeers = peers2.filter(function(p){return p.name&&p.name!=='N/A';});
  if(validPeers.length){
    html+='<div class="sec-hd">Peer Comparison \u2014 Probe42<' + '/div>';
    html+='<table class="fin-tbl"><thead><tr><th>Company<' + '/th><th>Revenue<' + '/th><th>PAT<' + '/th><th>City<' + '/th><' + '/tr><' + '/thead><tbody>';
    validPeers.forEach(function(p){
      var isSelf=(p.cin&&p.cin===result.cin)||(p.name&&result.company_name&&p.name.toLowerCase()===result.company_name.toLowerCase());
      html+='<tr style="'+(isSelf?'background:rgba(13,92,107,.06);font-weight:700':'')+'">'
        +'<td>'+esc(p.name)+(isSelf?' &#9733;':'')+'<' + '/td>'
        +'<td>'+esc(fmtINR(p.revenue))+'<' + '/td>'
        +'<td>'+esc(fmtINR(p.pat))+'<' + '/td>'
        +'<td>'+esc(p.city||'\u2014')+'<' + '/td><' + '/tr>';
    });
    html+='<' + '/tbody><' + '/table>';
  }

  // ── 10. Industry benchmark ────────────────────────────────────────────
  try{ html+=renderBenchmark(score,sector); }catch(e){}

  // ── 11. AI Intelligence Report ─────────────────────────────────────────
  html+='<div class="sec-hd">'+esc(tierLabel)+' Report<' + '/div>';
  html+='<div class="ai-card" style="padding:0;overflow:hidden">'
    +'<div style="padding:12px 18px;background:var(--tld);color:#fff;font-size:12px;font-weight:700">'
    +'AIRA REPORT \u2014 '+esc(company)+'<' + '/div>'
    +'<div id="ai-report-body-'+tier+'" style="padding:18px 20px">'+mdToHtml(clean)+'<' + '/div>'
    +'<' + '/div>';

  // ── 12. Score simulator + Fix engine ─────────────────────────────────
  try{ html+=renderSimulator(score); }catch(e){}
  try{ html+=renderFixEngine(); }catch(e){}


  // ── 13. Upsell for lower tiers ────────────────────────────────────────
  if(tier==='free'||tier==='doc'){
    html+='<div class="upsell">'
      +'<div class="upsell-icon">&#128300;<' + '/div>'
      +'<div><div class="upsell-ttl">Upgrade to AIRA Intelligence<' + '/div>'
      +'<div class="upsell-sub">Live Probe42 MCA data &middot; peer comparison &middot; director verification &middot; full 8,000-word report<' + '/div><' + '/div>'
      +'<button class="upsell-cta" onclick="switchTier(\'paid\')">Upgrade &#8594;<' + '/button>'
      +'<' + '/div>';
  }

  html+='<' + '/div>';
  out.innerHTML=html;
  try{initSimulator(score);}catch(e){}
  try{animateBenchmarkBar();}catch(e){}
}


async function runFreeCore(){
  return runTab('f-cin','f-sector','f-exchange','result-free','prog-free','btn-free-run','free',
    'You are AIRA, IPO Readiness AI. Write concise, data-driven analysis using exact Probe42 numbers.',
    'Write 4 paragraphs:\n[OVERVIEW]: Company description and business model.\n[FINANCIALS]: Key financial metrics analysis with specific numbers.\n[GOVERNANCE]: Board composition and compliance.\n[RECOMMENDATION]: IPO readiness score out of 10 with justification.',
    800);
}

async function runPaidCore(){
  return runTab('p-cin','p-sector','p-exchange','result-paid','prog-paid','btn-paid-run','paid',
    'You are AIRA SME Intel AI. Write precise SME IPO intelligence using exact financial data provided.',
    'Write 4 paragraphs:\n[OVERVIEW]: SME business profile, products, market positioning.\n[FINANCIALS]: Deep financial analysis - revenue trends, margin quality, return ratios, debt structure.\n[GOVERNANCE]: Board quality, MCA compliance, charge analysis.\n[RECOMMENDATION]: SME IPO eligibility verdict with specific gaps and actions.',
    800);
}

async function testWorkerNow(){
  var out = document.getElementById('result-test') 
         || document.getElementById('worker-test-result');
  if(!out){ alert('No test output area found.'); return; }
  out.innerHTML = '<div style="padding:14px;color:var(--mu)">⟳ Testing worker...<' + '/div>';
  try {
    var t0 = Date.now();
    var r = await workerPost({type:'probe42_raw', cin:'U74120MH1985PLC035308'});
    var ms = Date.now() - t0;
    var dbg = r._debug ? '<br><span style="color:#C9932A">Debug: '+JSON.stringify(r._debug)+'<' + '/span>' : '';
    var co = r.company_name && r.company_name!=='NOT FOUND' ? r.company_name : 'N/A — check Probe42 key/proxy';
    var rev = (r.financials||{}).revenue_fy24;
    out.innerHTML = '<div style="padding:14px"><b style="color:var(--ok)">✅ Worker OK ('+ms+'ms)<' + '/b><br>'
      + '<span style="font-size:12px;color:var(--mu)">Company: '+co+'<br>'
      + 'Revenue: '+(rev||'N/A')+'<br>'
      + 'Worker: <a href="'+WORKER+'" target="_blank">'+WORKER+'<' + '/a>'+dbg+'<' + '/span><' + '/div>';
  } catch(e){
    out.innerHTML = '<div style="padding:14px;color:var(--er)"><b>✗ Error:<' + '/b> '+esc(e.message)+'<br>'
      + '<small>Check: Worker deployed? ANTHROPIC_API_KEY set in Secrets?<' + '/small><' + '/div>';
  }
}


/* ════ TAB FUNCTIONS — all use same probe42+claude pattern ════ */














/* ════ UNIFIED TAB RUNNER ════ */

/* ════ SIMPLE REPORT RENDERER (for CA/CleanChit/DD/DirScan tabs) ════ */
function renderSimpleReport(result, cname, sector, outEl, tier) {
  if(!outEl) return;
  var report = result._report || result.report || '';
  var score  = result.score || 0;
  var col    = score>=78?'#1A9E6B':score>=65?'#E88A2E':score>=50?'#C9932A':'#C0392B';
  var label  = score>=78?'STRONG':'NEEDS WORK';
  var dims   = result;

  // Tier label map
  var tLabel = {ca:'CA/CS Compliance Bundle',clearchit:'Clean Chit Report',
    ddbundle:'Due Diligence Report',dirscan:'Director Scan Report',
    mainboard:'Mainboard ICDR Report',paid:'AIRA Intelligence Report',
    valintel:'Valuation Intelligence',valdoc:'Valuation Report'}[tier]||'AIRA Report';

  var html = '<div style="background:#fff;border-radius:14px;border:1px solid #E0EEF0;overflow:hidden;box-shadow:0 4px 20px rgba(13,92,107,.08)">';

  // Header
  html += '<div style="background:linear-gradient(135deg,#08404D,#0D5C6B);padding:20px 24px;color:#fff;display:flex;align-items:center;gap:18px">';
  html += '<div style="font-size:48px;font-weight:900;font-family:Georgia,serif;color:'+col+';line-height:1;min-width:60px;text-align:center">'+score+'<' + '/div>';
  html += '<div>';
  html += '<div style="font-size:10px;font-weight:800;letter-spacing:1px;opacity:.6;text-transform:uppercase;margin-bottom:3px">'+tLabel+'<' + '/div>';
  html += '<div style="font-size:18px;font-weight:800">'+xe(cname)+'<' + '/div>';
  html += '<div style="font-size:11px;opacity:.6;margin-top:2px">'+xe(sector)+'<' + '/div>';
  html += '<div style="margin-top:8px;display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:800;background:'+col+'22;color:'+col+';border:1px solid '+col+'44">'+label+'<' + '/div>';
  html += '<' + '/div>';
  // Score grid
  html += '<div style="margin-left:auto;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;min-width:180px">';
  [{k:'financial',l:'Financial'},{k:'governance',l:'Govern.'},{k:'compliance',l:'Comply'},
   {k:'promoter',l:'Promoter'},{k:'legal',l:'Legal'},{k:'readiness',l:'Readiness'}
  ].forEach(function(d){
    var v=dims[d.k]||0;
    var c=v>=70?'#1A9E6B':v>=55?'#E88A2E':'#C0392B';
    html+='<div style="background:rgba(255,255,255,.1);border-radius:6px;padding:5px 8px;text-align:center">';
    html+='<div style="font-size:14px;font-weight:800;color:'+c+'">'+v+'<' + '/div>';
    html+='<div style="font-size:8px;opacity:.55;text-transform:uppercase">'+d.l+'<' + '/div><' + '/div>';
  });
  html += '<' + '/div>';
  html += '<' + '/div>';

  // Report body
  html += '<div style="padding:22px 24px;font-size:13px;line-height:1.8;color:#1A2E35">';
  html += md2html(report);
  html += '<' + '/div>';

  // Actions
  html += '<div style="padding:12px 24px;border-top:1px solid #E8F4F6;display:flex;gap:8px;background:#F8FCFD">';
  html += '<button onclick="previewReport(\''+tier+'\')" style="padding:8px 18px;background:#08404D;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">🖨 Print / Save PDF<' + '/button>';
  html += '<' + '/div>';
  html += '<' + '/div>';

  outEl.innerHTML = html;
  AIRA_RESULTS[tier] = {result:result, cname:cname, sector:sector, tier:tier};
}

async function runTab(cinId, secId, excId, outId, progId, btnId, tier, customSystem, customPromptSuffix, customTokens){
  var cin=(document.getElementById(cinId)||{}).value||'';
  cin=cin.trim().toUpperCase().replace(/^UNKNOWN/,'');
  var sector=(document.getElementById(secId)||{}).value||'Manufacturing';
  var exchange=(document.getElementById(excId)||{}).value||'NSE Emerge (SME)';
  if(!cin){alert('Please enter CIN.');return;}
  var btn=document.getElementById(btnId),prog=document.getElementById(progId),out=document.getElementById(outId);
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generating Report\u2026';}
  if(out)out.innerHTML='<div style="padding:20px;text-align:center;color:#6B8A94;font-size:13px">Fetching company data from Probe42\u2026</div>';
  if(prog)prog.style.display='flex';

  var updateStatus=function(msg){if(out){var el=out.querySelector('.status-msg');if(el)el.textContent=msg;else out.innerHTML='<div class="status-msg" style="padding:20px;text-align:center;color:#6B8A94;font-size:13px">'+msg+'</div>';}};

  try{
    var p42=await workerPost({type:'probe42_raw',cin:cin});
    var cname=(p42&&p42.company_name&&p42.company_name!=='NOT FOUND')?p42.company_name:cin;
    var f=(p42&&p42.financials)||{},dirs=(p42&&p42.directors)||[],chgs=(p42&&p42.charges)||[];

    var rev=+(parseFloat(f.revenue_fy24)||0).toFixed(2);
    var pat=+(parseFloat(f.pat_fy24)||0).toFixed(2);
    var ePct=+(parseFloat(f.ebitda_margin)||0).toFixed(1);
    var eCr=+(parseFloat(f.ebitda_cr)||(rev*ePct/100)||0).toFixed(2);
    var nw=+(parseFloat(f.net_worth)||0).toFixed(2);
    var debt=+(parseFloat(f.total_debt)||0).toFixed(2);
    var de=+(parseFloat(f.debt_equity_ratio)||(nw>0?debt/nw:0)).toFixed(2);
    var roe=+(parseFloat(f.roe)||0).toFixed(1);
    var roce=+(parseFloat(f.roce)||0).toFixed(1);
    var netM=+(rev>0?pat/rev*100:0).toFixed(1);
    var cr2=+(parseFloat(f.current_ratio)||0).toFixed(2);
    var intCov=+(parseFloat(f.interest_coverage)||0).toFixed(1);
    var assets=+(parseFloat(f.total_assets)||0).toFixed(2);
    var rev23raw=parseFloat(f.revenue_fy23)||0; var rev23=rev23raw>=1?+rev23raw.toFixed(2):0;
    var rev22raw=parseFloat(f.revenue_fy22)||0; var rev22=rev22raw>=1?+rev22raw.toFixed(2):0;
    var pat23raw=parseFloat(f.pat_fy23)||0; var pat23=pat23raw>0&&pat23raw<rev23raw*0.5?+pat23raw.toFixed(2):0;
    var pat22raw=parseFloat(f.pat_fy22)||0; var pat22=pat22raw>0&&pat22raw<rev22raw*0.5?+pat22raw.toFixed(2):0;
    var revGr=rev23>0?+((rev-rev23)/rev23*100).toFixed(1):0;
    var yr24=f.fy24_year||'FY24',yr23=f.fy23_year||'FY23',yr22=f.fy22_year||'FY22';
    var fixYr=function(yr,d){if(!yr)return d;var s=String(yr).replace(/FY/i,'').trim();var n=parseInt(s);if(isNaN(n))return d;if(n>=2000)n=n%100;return(n>=18&&n<=30)?'FY'+n:d;};
    yr24=fixYr(yr24,'FY24');yr23=fixYr(yr23,'FY23');yr22=fixYr(yr22,'FY22');
    var openChgs=chgs.filter(function(c){return c.status==='Open';}).length;

    // JS IPO Score
    var score=0;
    if(roe>=20)score+=15;else if(roe>=12)score+=8;
    if(roce>=15)score+=15;else if(roce>=10)score+=8;
    if(rev>=50)score+=10;else if(rev>=20)score+=5;
    if(pat>=5)score+=10;else if(pat>=2)score+=5;
    if(nw>=10)score+=10;else if(nw>=5)score+=5;
    if(ePct>=15)score+=10;else if(ePct>=10)score+=5;
    if(de<=1)score+=10;else if(de<=2)score+=5;
    if(openChgs===0)score+=10;else if(openChgs<=2)score+=5;
    if(dirs.length>=3)score+=5;if(dirs.length>=5)score+=5;
    score=Math.min(100,score);

    // Gaps & Red Flags
    var gaps=[],redFlags=[],actions=[];
    if(roe<20)gaps.push('ROE '+roe+'% below 20% benchmark — improve capital efficiency');
    if(roce<15)gaps.push('ROCE '+roce+'% below 15% — optimize capital deployment');
    if(ePct<15)gaps.push('EBITDA '+ePct+'% below 15% healthy threshold');
    if(de>1)gaps.push('D/E '+de+'x above 1x — reduce borrowings before IPO');
    if(dirs.length<5)gaps.push('Board has only '+dirs.length+' directors — appoint independent directors');
    if(openChgs>0){redFlags.push(''+openChgs+' open charges on MCA register — obtain satisfaction certificates');actions.push('Clear all '+openChgs+' open charges — obtain NOC from lenders');}
    if(dirs.length<5)actions.push('Appoint '+(5-dirs.length)+' independent directors per SEBI guidelines');
    actions.push('Prepare 3-year restated financials with Big 4 audit quality');
    actions.push('Engage SEBI-registered Merchant Banker for DRHP preparation');
    actions.push('File DRHP with SEBI/Stock Exchange and address observations');
    if(redFlags.length===0)redFlags.push('No critical regulatory red flags identified in MCA records');

    var scoreColor=score>=75?'#1A6B3A':score>=50?'#E67E22':'#C0392B';
    var scoreLabel=score>=75?'IPO READY':score>=50?'CONDITIONAL':'NOT READY';
    var tierColors={free:'#0D5C6B',paid:'#1A5C8A',mainboard:'#1A3A5C',ca:'#2A4A2A',
      clearchit:'#3A1A5C',dirscan:'#5C3A1A',ddbundle:'#1A1A5C',deepresearch:'#3B30B0'};
    var ac=tierColors[tier]||'#08404D';
    var tierNames={free:'AIRA IPO Score',paid:'SME Intel',mainboard:'Mainboard ICDR',
      ca:'CA/CS Compliance',clearchit:'Clean Chit',dirscan:'Director Scan',
      ddbundle:'Due Diligence Bundle',deepresearch:'Deep Research'};
    var rTitle=tierNames[tier]||'IPO Report';

    var sysP=customSystem||'You are a Senior Partner at KPMG/Deloitte specializing in IPO advisory. Write comprehensive Big 4 standard reports with tables, numbered sections, specific regulatory references, and actionable insights. Use exact financial data provided.';

    // Base financial data string passed to all Claude calls
    var listingNote=(p42&&p42.listing_status&&p42.listing_status.toLowerCase()==='listed')?'(Currently listed - Migration/Upgrade scenario)':'PRIVATE LIMITED COMPANY - CURRENTLY UNLISTED (Pre-IPO Analysis)';
    var fd='COMPANY: '+cname+' | CIN: '+cin+' | SECTOR: '+sector+' | TARGET EXCHANGE: '+exchange+' | STATUS: '+listingNote
      +'\nREVENUE: '+yr22+'=\u20b9'+rev22+' Cr, '+yr23+'=\u20b9'+rev23+' Cr, '+yr24+'=\u20b9'+rev+' Cr ('+revGr+'% YoY)'
      +'\nPAT '+yr24+'=\u20b9'+pat+' Cr ('+netM+'% margin) | EBITDA='+ePct+'% (\u20b9'+eCr+' Cr)'
      +'\nNET WORTH=\u20b9'+nw+' Cr | DEBT=\u20b9'+debt+' Cr | D/E='+de+'x | ASSETS=\u20b9'+assets+' Cr'
      +'\nROE='+roe+'% | ROCE='+roce+'% | CURRENT RATIO='+cr2+'x | INTEREST COVERAGE='+intCov+'x'
      +'\nDIRECTORS='+dirs.length+' | OPEN CHARGES='+openChgs+'/'+chgs.length+' total | IPO SCORE='+score+'/100';

    var tierPrompts={
      free:{
        p1:'Write Section 1 - COMPANY OVERVIEW & BUSINESS ANALYSIS (detailed, 400 words):\n- Company history and incorporation details\n- Business model: products, services, revenue streams\n- Market positioning in '+sector+' sector\n- Competitive advantages and USPs\n- Key customers and sectors served\n- Manufacturing/operational capabilities\n- Growth strategy and expansion plans',
        p2:'Write Section 2 - FINANCIAL PERFORMANCE ANALYSIS (detailed, 400 words):\n- 3-year revenue trend analysis with CAGR calculation\n- Profitability trajectory: EBITDA '+ePct+'%, PAT '+netM+'%\n- Return metrics: ROE '+roe+'% and ROCE '+roce+'% vs sector benchmarks\n- Balance sheet strength: NW \u20b9'+nw+' Cr, D/E '+de+'x\n- Working capital and liquidity analysis\n- Cash flow quality assessment\n- Include a financial metrics table',
        p3:'Write Section 3 - GOVERNANCE & REGULATORY COMPLIANCE (detailed, 400 words):\n- Board composition analysis ('+dirs.length+' directors assessment)\n- Director profiles and independence requirements\n- '+openChgs+' open charges detailed analysis\n- MCA filing compliance status\n- SEBI pre-IPO governance requirements\n- Related party transactions assessment\n- Audit quality and statutory compliance',
        p4:'Write Section 4 - IPO READINESS VERDICT & ACTION PLAN (detailed, 400 words):\n- NSE Emerge / Main Board eligibility check vs SEBI ICDR criteria\n- IPO Score justification: '+score+'/100\n- Valuation range estimate (P/E, EV/EBITDA basis)\n- 12-month IPO roadmap with milestones\n- Priority action items with timeline\n- Investment recommendation\n- Key risks and mitigation'
      },
      paid:{
        p1:'Write Section 1 - SME INTELLIGENCE REPORT: BUSINESS & MARKET ANALYSIS (400 words):\n- Detailed company profile and operational overview\n- Product portfolio with segment analysis\n- NSE Emerge eligibility assessment vs SEBI SME criteria\n- Market size and competitive landscape in '+sector+'\n- Revenue composition and growth quality assessment\n- Customer concentration and stickiness analysis\n- SWOT analysis in table format',
        p2:'Write Section 2 - FINANCIAL DEEP-DIVE ANALYSIS (400 words):\n- Revenue CAGR analysis: '+rev22+' \u2192 '+rev+' Cr\n- Margin analysis: EBITDA '+ePct+'%, PAT '+netM+'% vs SME benchmarks\n- Return ratios: ROE '+roe+'%, ROCE '+roce+'% - sustainability assessment\n- Balance sheet forensics: debt \u20b9'+debt+' Cr, D/E '+de+'x\n- Working capital cycle analysis\n- Earnings quality: cash PAT vs reported PAT\n- Financial red flag screening\n- Include detailed financial ratios comparison table',
        p3:'Write Section 3 - SME COMPLIANCE & GOVERNANCE ASSESSMENT (400 words):\n- SEBI SME listing eligibility checklist (table format)\n- NSE Emerge specific requirements\n- Board governance vs SEBI SME norms\n- '+openChgs+' open charges - lender-wise assessment\n- MCA compliance calendar review\n- Secretarial audit requirements\n- Pre-IPO restructuring checklist',
        p4:'Write Section 4 - SME IPO STRATEGY & INVESTMENT VERDICT (400 words):\n- IPO pricing strategy and valuation band (15-20x PE basis)\n- GMP prediction methodology\n- Allotment strategy recommendation\n- Post-listing performance expectations\n- Merchant banker selection criteria\n- DRHP preparation timeline: 6-9 months\n- Investment recommendation: SUBSCRIBE/NEUTRAL/AVOID with rationale\n- Score: '+score+'/100 breakdown'
      },
      mainboard:{
        p1:'Write Section 1 - MAINBOARD ICDR ELIGIBILITY ANALYSIS (400 words):\n- SEBI ICDR Regulation 6 eligibility check (full table)\n- Profitability track record: 3-year PAT requirement\n- Net tangible asset threshold: Rs 3 Cr minimum\n- Net worth requirement: Rs 1 Cr minimum\n- Promoter experience requirements\n- Company history and corporate actions\n- Alternative eligibility routes (QIB/Grading)',
        p2:'Write Section 2 - MAINBOARD FINANCIAL BENCHMARKING (400 words):\n- Revenue scale: \u20b9'+rev+' Cr vs typical mainboard companies (Rs 200-500 Cr)\n- Profitability metrics vs Nifty 500 sector benchmarks\n- ROE '+roe+'% and ROCE '+roce+'% comparison\n- Pre-IPO valuation assessment (EV/EBITDA, P/E, P/B)\n- Float size estimation (25% minimum public holding)\n- IPO proceeds utilization strategy\n- Detailed financial ratios table',
        p3:'Write Section 3 - MAINBOARD GOVERNANCE & SEBI LODR COMPLIANCE (400 words):\n- Board composition vs SEBI LODR Regulation 17 requirements\n- Independent directors (min 1/3 requirement)\n- Audit Committee - Regulation 18 compliance\n- Nomination & Remuneration Committee\n- Stakeholder Relationship Committee\n- Risk Management Committee\n- Related Party Transaction Policy\n- Insider Trading Code requirements\n- '+openChgs+' charges assessment',
        p4:'Write Section 4 - MAINBOARD IPO ROADMAP & VERDICT (400 words):\n- Mainboard vs SME platform comparison table\n- 18-24 month roadmap with regulatory milestones\n- DRHP preparation requirements\n- SEBI filing process and observation timeline\n- Book building process guidance\n- Anchor investor strategy\n- Listing day strategy\n- Investment verdict and score: '+score+'/100'
      },
      ca:{
        p1:'Write Section 1 - ROC & MCA STATUTORY COMPLIANCE (400 words):\n- Annual return filing status FY22/FY23/FY24\n- Form AOC-4 (financial statements) filing history\n- Form MGT-7 compliance timeline\n- Director DIN compliance under Section 153-159\n- Registered office compliance\n- Charge register maintenance - '+openChgs+' open charges analysis\n- MCA portal compliance dashboard\n- Show compliance status table with filing dates',
        p2:'Write Section 2 - SECRETARIAL & AUDIT COMPLIANCE (400 words):\n- Statutory registers: Members, Directors, Contracts\n- Board meeting compliance: minutes, quorum, frequency\n- AGM compliance history\n- Auditor appointment and rotation compliance (Section 139)\n- ICAI peer review status\n- Related party disclosure requirements\n- Secretarial Standards SS-1 and SS-2 compliance\n- CSR applicability and compliance',
        p3:'Write Section 3 - TAX & REGULATORY COMPLIANCE (400 words):\n- Income tax filing status and pending demands\n- GST registration and return filing status\n- TDS/TCS compliance\n- Labour law compliance: PF, ESI, Gratuity\n- Environmental clearances for manufacturing\n- Industrial licenses and permissions\n- Import/Export compliance (if applicable)\n- Show compliance checklist table',
        p4:'Write Section 4 - PRE-IPO COMPLIANCE ACTION PLAN (400 words):\n- Critical compliance gaps identified\n- CA/CS deliverables for IPO: list with timelines\n- SEBI compliance requirements checklist\n- Statutory audit upgrade recommendations\n- Internal audit framework requirements\n- Compliance calendar: 12-month pre-IPO\n- Estimated timeline and cost\n- Priority matrix: Critical/High/Medium/Low'
      },
      clearchit:{
        p1:'Write Section 1 - MCA & ROC CLEAN CHIT ASSESSMENT (400 words):\n- Company active status verification\n- Filing compliance clean chit: FY22, FY23, FY24\n- No show-cause notices: verification\n- Strike-off risk assessment\n- Director disqualification status under Section 164\n- Charge register analysis: '+openChgs+' open charges\n- Beneficial ownership disclosure compliance\n- Verified green/amber/red ratings in table format',
        p2:'Write Section 2 - FINANCIAL CLEAN CHIT ASSESSMENT (400 words):\n- Audit opinion quality: unqualified/qualified/adverse\n- Going concern assessment\n- Statutory audit findings FY22-FY24\n- Tax compliance clean chit (Income Tax, GST)\n- RBI/FEMA compliance (if applicable)\n- Related party transactions arm\'s length verification\n- Financial fraud indicators screening\n- Contingent liabilities assessment',
        p3:'Write Section 3 - GOVERNANCE CLEAN CHIT (400 words):\n- Director background verification\n- Criminal records check methodology\n- Wilful defaulter list check\n- CIBIL/credit bureau compliance\n- Insider trading policy compliance\n- Whistleblower mechanism\n- ESG compliance indicators\n- Industry-specific regulatory compliance (manufacturing)',
        p4:'Write Section 4 - CLEAN CHIT FINAL VERDICT (400 words):\n- Overall clean chit rating: GREEN/AMBER/RED\n- SEBI clean chit requirements for IPO\n- Areas requiring remediation before DRHP\n- Lender NOC requirements for '+openChgs+' charges\n- Legal opinion requirements\n- Timeline for clean chit achievement\n- Probability of SEBI approval: estimate\n- Final recommendation'
      },
      ddbundle:{
        p1:'Write Section 1+2 - BUSINESS & OPERATIONAL DUE DILIGENCE (comprehensive Merchant Banker standard):\n'
          +'(1) Business model assessment table: Model Component|Quality|Sustainability|Risk\n'
          +'(2) Revenue quality analysis: recurring vs one-time, customer concentration, pricing power\n'
          +'(3) Product/service portfolio: differentiation, IP, technology assessment\n'
          +'(4) Operational DD: capacity utilization, manufacturing excellence, supply chain\n'
          +'(5) Customer DD: top 10 customers by %, contract terms, churn risk\n'
          +'(6) Supplier DD: key suppliers, concentration, substitutability\n'
          +'(7) Industry position: market share, growth drivers, competitive threats table',
        p2:'Write Section 3+4 - FINANCIAL DUE DILIGENCE (Big 4 standard):\n'
          +'(1) Quality of earnings assessment: normalized EBITDA reconciliation\n'
          +'(2) Revenue recognition policy: compliance with Ind AS 115\n'
          +'(3) Working capital forensics: DSO trend, inventory build-up, payables stretch\n'
          +'(4) EBITDA to FCF bridge: operating CF vs reported earnings\n'
          +'(5) Off-balance sheet items: contingent liabilities, guarantees, lease obligations\n'
          +'(6) Related party transactions: arm length verification, disclosure adequacy\n'
          +'(7) Accounting policy changes and restatements (3 years)\n'
          +'(8) Tax due diligence: deferred tax, pending demands, transfer pricing',
        p3:'Write Section 5+6 - LEGAL, GOVERNANCE & REGULATORY DUE DILIGENCE:\n'
          +'(1) Litigation screening table: Case Type|Court|Amount|Status|Probability|Impact\n'
          +'(2) '+openChgs+' open charges: lender details, amounts, security, covenant review\n'
          +'(3) Contract review: key agreements, change of control clauses, termination rights\n'
          +'(4) Employment: key man risk, ESOP obligations, labour compliance\n'
          +'(5) Environmental & regulatory: factory licenses, PCB NOC, IS certifications\n'
          +'(6) IP assessment: patents, trademarks, trade secrets, IP ownership\n'
          +'(7) Corporate structure: holding company issues, cross-default risks',
        p4:'Write Section 7+8 - DD VERDICT & MERCHANT BANKER ASSESSMENT:\n'
          +'(1) DD findings summary table: Finding|Category|Severity(Critical/High/Medium/Low)|Status\n'
          +'(2) Conditions Precedent to IPO Filing (priority matrix)\n'
          +'(3) Material Adverse Change (MAC) triggers identified\n'
          +'(4) Representations and Warranties: key reps requiring indemnification\n'
          +'(5) Price adjustment mechanisms based on DD findings\n'
          +'(6) Merchant Banker DD rating: GREEN/AMBER/RED with justification\n'
          +'(7) Post-IPO monitoring: KPIs to track, reporting requirements\n'
          +'(8) Overall DD verdict: PROCEED/CONDITIONAL/DEFER with score '+score+'/100'
      }


      ,dirscan:{
        p1:'Write Section 1 - BOARD COMPOSITION & DIRECTOR PROFILES (400 words):\n'
          +'(1) Board composition table: Director Name|DIN|Designation|Appointment Date|Independence\n'
          +'(2) Director-wise profile: qualifications, industry experience, other directorships\n'
          +'(3) Board size assessment: '+dirs.length+' directors vs SEBI requirements\n'
          +'(4) Promoter vs independent ratio analysis\n'
          +'(5) Gender diversity on board',
        p2:'Write Section 2 - DIRECTOR COMPLIANCE & DIN STATUS (400 words):\n'
          +'(1) DIN compliance table for all directors\n'
          +'(2) Section 164 disqualification check: Undischarged insolvency, conviction, fraud\n'
          +'(3) Section 167 disqualification: Non-filing defaults\n'
          +'(4) Multiple directorships: conflicts of interest assessment\n'
          +'(5) Director remuneration disclosure requirements',
        p3:'Write Section 3 - GOVERNANCE ASSESSMENT (400 words):\n'
          +'(1) Board independence ratio vs SEBI LODR Regulation 17\n'
          +'(2) Audit Committee - Regulation 18 status\n'
          +'(3) Nomination & Remuneration Committee\n'
          +'(4) Related party transaction oversight\n'
          +'(5) Succession planning and key-person risk assessment',
        p4:'Write Section 4 - GOVERNANCE VERDICT & RECOMMENDATIONS (400 words):\n'
          +'(1) Governance scorecard table: 10 parameters, score out of 10\n'
          +'(2) Critical actions before IPO filing\n'
          +'(3) Independent director appointment requirements\n'
          +'(4) Board committee setup timeline\n'
          +'(5) Governance rating: STRONG/ADEQUATE/WEAK with justification'
      }
    };  // end tierPrompts

    var tp=tierPrompts[tier]||tierPrompts.free;

    updateStatus('Section 1/4 — Business & Market…');
    var r1=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1500,
      system:sysP,messages:[{role:'user',content:fd+'\n\n'+tp.p1}]});
    var s1=(r1&&r1.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    updateStatus('Section 2/4 — Financial Analysis…');
    var r2=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1500,
      system:sysP,messages:[{role:'user',content:fd+'\n\n'+tp.p2}]});
    var s2=(r2&&r2.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    updateStatus('Section 3/4 — Governance & Compliance…');
    var r3=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1500,
      system:sysP,messages:[{role:'user',content:fd+'\n\n'+tp.p3}]});
    var s3=(r3&&r3.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    updateStatus('Section 4/4 — Verdict & Action Plan…');
    var r4=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1500,
      system:sysP,messages:[{role:'user',content:fd+'\n\n'+tp.p4}]});
    var s4=(r4&&r4.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    if(prog)prog.style.display='none';
    if(btn){btn.disabled=false;btn.innerHTML='&#9654; Run';}

    var na='<span style="color:#C0C8D0">N/A</span>';
    var html='<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:900px;color:#1A2E35">';
    // Cover
    html+='<div style="background:linear-gradient(135deg,'+ac+','+ac+'DD);color:#fff;border-radius:12px;padding:22px 26px;margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +'<div><div style="font-size:9px;letter-spacing:2px;opacity:.6;text-transform:uppercase;margin-bottom:5px">'+rTitle+'</div>'
      +'<div style="font-size:22px;font-weight:900">'+esc(cname)+'</div>'
      +'<div style="font-size:12px;opacity:.75;margin-top:4px">'+esc(sector)+' · TARGET: '+esc(exchange)+' · PRIVATE UNLISTED</div>'
      +'<div style="font-size:10px;opacity:.5;margin-top:3px">CIN: '+esc(cin)+' · '+new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+'</div></div>'
      +'<div style="text-align:center;min-width:80px">'
      +'<div style="font-size:42px;font-weight:900;color:'+scoreColor+';line-height:1">'+score+'</div>'
      +'<div style="font-size:9px;opacity:.7">/100 · '+scoreLabel+'</div>'
      +'<button onclick="printReport(\''+tier+'\')" style="margin-top:6px;padding:4px 12px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-size:10px;cursor:pointer">&#128438; Print</button>'
      +'</div></div></div>';
    // Metric cards
    html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
    var metCards=[['Revenue ('+yr24+')','&#8377;'+rev+' Cr'],['PAT ('+yr24+')','&#8377;'+pat+' Cr'],
     ['EBITDA',ePct+'%'],['Net Worth','&#8377;'+nw+' Cr'],
     ['ROE',roe+'%'],['ROCE',roce+'%'],['D/E',de+'x'],
     ['Charges',openChgs+(openChgs===0?' &#9989;':' &#9888;')]];
    metCards.forEach(function(c){
      html+='<div style="background:#fff;border:1px solid #E0EAF0;border-left:3px solid '+ac+';border-radius:8px;padding:10px 12px">'
        +'<div style="font-size:9px;color:#8A9AAB;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">'+c[0]+'</div>'
        +'<div style="font-size:15px;font-weight:800;color:#1A2E35">'+c[1]+'</div></div>';
    });
    html+='</div>';
    // 3-yr table
    html+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:700;color:'+ac+';text-transform:uppercase;margin-bottom:10px">3-Year Financial Performance</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB">'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Metric</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">'+yr22+'</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">'+yr23+'</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">'+yr24+'</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">YoY</th>'
      +'</tr></thead><tbody>'
      +[['Revenue (₹ Cr)',rev22>0?rev22:na,rev23>0?rev23:na,rev,revGr>0?'<span style="color:#1A6B3A">▲'+revGr+'%</span>':na],
        ['PAT (₹ Cr)',pat22>0?pat22:na,pat23>0?pat23:na,pat,netM+'% margin'],
        ['EBITDA (₹ Cr)',na,na,eCr,ePct+'% margin'],
        ['Net Worth (₹ Cr)',na,na,nw,'D/E: '+de+'x']
       ].map(function(r,i){
        return '<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
          +'<td style="padding:7px 10px;font-weight:600">'+r[0]+'</td>'
          +'<td style="padding:7px 10px;text-align:center;color:#6B8A94">'+r[1]+'</td>'
          +'<td style="padding:7px 10px;text-align:center;color:#6B8A94">'+r[2]+'</td>'
          +'<td style="padding:7px 10px;text-align:center;font-weight:700;color:'+ac+'">'+r[3]+'</td>'
          +'<td style="padding:7px 10px;text-align:center;font-size:11px">'+r[4]+'</td></tr>';
       }).join('')
      +'</tbody></table></div>';
    // Ratios table
    html+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:700;color:'+ac+';text-transform:uppercase;margin-bottom:10px">Key Ratios vs Benchmarks</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB">'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Ratio</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">FY24</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">Benchmark</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">Status</th>'
      +'</tr></thead><tbody>';
    [['ROE',roe+'%','>20%',roe>=20],['ROCE',roce+'%','>15%',roce>=15],
     ['EBITDA%',ePct+'%','>15%',ePct>=15],['Net Margin',netM+'%','>8%',netM>=8],
     ['D/E',de+'x','<1x',de<=1],['Int Coverage',intCov+'τ','>3x',intCov>=3||intCov===0],
     ['Curr Ratio',cr2+'x','>1.5x',cr2>=1.5||cr2===0]
    ].forEach(function(r,i){
      html+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
        +'<td style="padding:7px 10px;font-weight:600">'+r[0]+'</td>'
        +'<td style="padding:7px 10px;text-align:center;font-weight:700;color:'+(r[3]?'#1A6B3A':'#C0392B')+'">'+r[1]+'</td>'
        +'<td style="padding:7px 10px;text-align:center;font-size:11px;color:#6B8A94">'+r[2]+'</td>'
        +'<td style="padding:7px 10px;text-align:center">'+(r[3]?'&#9989;':'&#9888;&#65039;')+'</td></tr>';
    });
    html+='</tbody></table></div>';
    // 4 AI sections
    var secDefs=[['Business & Market Analysis',s1,'#EFF6FF','#1A5C8A'],
      ['Financial Analysis',s2,'#F0FFF4','#1A6B3A'],
      ['Governance & Compliance',s3,'#FFF5E8','#B5370A'],
      ['IPO Verdict & Action Plan',s4,'#F5F0FF','#5B4ED4']];
    secDefs.forEach(function(sec,idx){
      if(!sec[1]||sec[1].length<10) return;
      html+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;overflow:hidden;margin-bottom:14px">'
        +'<div style="background:'+sec[3]+';padding:10px 16px;display:flex;align-items:center;gap:10px">'
        +'<div style="width:24px;height:24px;background:rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">'+(idx+1)+'</div>'
        +'<div style="font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.3px">'+sec[0]+'</div>'
        +'</div><div style="padding:16px 18px;background:'+sec[2]+'" class="ai-body">'+md2html(sec[1])+'</div></div>';
    });
    // IPO Assessment
    html+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:16px;margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:800;color:#08404D;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">IPO Readiness Assessment</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
      +'<div style="background:#FFFBF0;border-left:3px solid #E88A2E;border-radius:0 8px 8px 0;padding:12px">'
      +'<div style="font-size:10px;font-weight:700;color:#8A4A1A;text-transform:uppercase;margin-bottom:8px">&#128204; Gaps to Address</div>'
      +(gaps.length?'<ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.9">'+gaps.map(function(g){return '<li>'+esc(g)+'</li>';}).join('')+'</ul>':'<p style="font-size:12px;color:#1A6B3A;margin:0">&#9989; No major gaps</p>')
      +'</div>'
      +'<div style="background:#FFF5F0;border-left:3px solid #C0392B;border-radius:0 8px 8px 0;padding:12px">'
      +'<div style="font-size:10px;font-weight:700;color:#C0392B;text-transform:uppercase;margin-bottom:8px">&#128683; Red Flags</div>'
      +(redFlags[0]&&redFlags[0].indexOf('No critical')!==0?'<ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.9">'+redFlags.map(function(g){return '<li>'+esc(g)+'</li>';}).join('')+'</ul>':'<p style="font-size:12px;color:#1A6B3A;margin:0">&#9989; Clean</p>')
      +'</div></div>'
      +'<div style="background:#F0FFF4;border:1px solid #C0EDD6;border-radius:8px;padding:12px">'
      +'<div style="font-size:10px;font-weight:700;color:#1A6B3A;text-transform:uppercase;margin-bottom:8px">&#9989; Pre-IPO Action Plan</div>'
      +'<ol style="margin:0;padding-left:18px;font-size:12px;line-height:1.9">'+actions.map(function(a){return '<li>'+esc(a)+'</li>';}).join('')+'</ol>'
      +'</div></div>';
    // Directors
    if(dirs.length){
      html+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:12px">'
        +'<div style="font-size:11px;font-weight:700;color:'+ac+';text-transform:uppercase;margin-bottom:10px">Board of Directors ('+dirs.length+')</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB">'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Name</th>'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Designation</th>'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">DIN</th></tr></thead><tbody>';
      dirs.forEach(function(d,i){
        html+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
          +'<td style="padding:7px 10px;font-weight:600">'+esc(d.name||'')+'</td>'
          +'<td style="padding:7px 10px;color:#444">'+esc(d.designation||'Director')+'</td>'
          +'<td style="padding:7px 10px;color:#6B8A94;font-size:11px">'+esc(d.din||'')+'</td></tr>';
      });
      html+='</tbody></table></div>';
    }
    if(chgs.length){
      html+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:12px">'
        +'<div style="font-size:11px;font-weight:700;color:'+ac+';text-transform:uppercase;margin-bottom:10px">Charge Register ('+chgs.length+' total · '+openChgs+' open)</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB">'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Holder</th>'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Status</th>'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Amount</th>'
        +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Date</th></tr></thead><tbody>';
      chgs.forEach(function(c,i){
        var holder=c.charge_holder||c.holder||c.lender_name||c.bank||'Financial Institution';
        var amt=c.amount?(+(parseFloat(c.amount)/100000).toFixed(1)+' L'):'N/D';
        html+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'">'
          +'<td style="padding:7px 10px;font-weight:600">'+esc(holder)+'</td>'
          +'<td style="padding:7px 10px"><span style="color:'+(c.status==='Open'?'#C0392B':'#1A6B3A')+';font-weight:600;font-size:11px">'+esc(c.status||'')+'</span></td>'
          +'<td style="padding:7px 10px">'+esc(amt)+'</td>'
          +'<td style="padding:7px 10px;color:#6B8A94;font-size:11px">'+esc(c.date_of_creation||'')+'</td></tr>';
      });
      html+='</tbody></table></div>';
    }
    html+='<div style="padding:8px 14px;background:#F8F9FA;border-radius:6px;font-size:10px;color:#9AB0B8">ipowork is not SEBI-registered. Not investment advice. Data: Probe42/MCA. © 2025 ipowork.</div></div>';
    if(out){out.innerHTML=html;out.scrollIntoView({behavior:'smooth',block:'start'});}
    var result={_report:html,company_name:cname,cin:cin,sector:sector,exchange:exchange,tier:tier,
      revenue_cr:rev,pat_cr:pat,ipo_score:score};
    AIRA_RESULTS[tier]={result:result,cname:cname,sector:sector,tier:tier};
    saveReportToStore(tier,cname,sector,result);
    updateFullReportBtn();
  }catch(e){
    if(prog)prog.style.display='none';
    if(btn){btn.disabled=false;btn.innerHTML='&#9654; Run';}
    if(out)out.innerHTML='<div class="err-card"><b>Error:</b> '+esc(e.message)+'</div>';
  }
}


// ===== SIMPLE WRAPPERS =====
async function runFreeCore(){ return runTab('f-cin','f-sector','f-exchange','result-free','prog-free','btn-free-run','free',null,null,null); }
async function runPaidCore(){ return runTab('p-cin','p-sector','p-exchange','result-paid','prog-paid','btn-paid-run','paid',null,null,null); }
async function runMainboardCore(){ return runTab('mb-cin','mb-sector','mb-exchange','result-mainboard','prog-mainboard','btn-mb-run','mainboard',null,null,null); }
async function runCACore(){ return runTab('ca-cin','ca-sector','ca-exchange','result-ca','prog-ca','btn-ca-run','ca',null,null,null); }
async function runCleanChitCore(){ return runTab('clearchit-cin','clearchit-sector','clearchit-exchange','result-clearchit','prog-clearchit','btn-cc-run','clearchit',null,null,null); }
async function runDDBundle(){ return runTab('ddbundle-cin','ddbundle-sector','ddbundle-exchange','result-ddbundle','prog-ddbundle','btn-dd-run','ddbundle',null,null,null); }
async function runDirScan(){ return runTab('dirscan-cin','dirscan-sector','dirscan-exchange','result-dirscan','prog-dirscan','btn-ds-run','dirscan',null,null,null); }
async function runValuationIntel(){
  var cin=(document.getElementById('valintel-cin')||{}).value||'';
  cin=cin.trim().toUpperCase();
  var sector=(document.getElementById('valintel-sector')||{}).value||'Manufacturing';
  var exchange=(document.getElementById('valintel-exchange')||{}).value||'NSE Main Board';
  if(!cin){alert('Please enter CIN.');return;}
  var btn=document.getElementById('btn-vi-run'),prog=document.getElementById('prog-valintel'),out=document.getElementById('result-valintel');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Generating Intelligence\u2026';}
  if(out)out.innerHTML='<div style="padding:20px;text-align:center;color:#6B8A94">Fetching data\u2026</div>';
  if(prog)prog.style.display='flex';
  var setS=function(m){if(btn)btn.innerHTML='<span class="spinner"></span> '+m;};
  try{
    var p42=await workerPost({type:'probe42_raw',cin:cin});
    var cname=(p42&&p42.company_name&&p42.company_name!=='NOT FOUND')?p42.company_name:cin;
    var f=(p42&&p42.financials)||{},dirs=(p42&&p42.directors)||[],chgs=(p42&&p42.charges)||[];
    var rev=+(parseFloat(f.revenue_fy24)||0).toFixed(2),pat=+(parseFloat(f.pat_fy24)||0).toFixed(2);
    var ePct=+(parseFloat(f.ebitda_margin)||0).toFixed(2);
    var eCr=+(parseFloat(f.ebitda_cr)||(rev*ePct/100)||0).toFixed(2);
    var nw=+(parseFloat(f.net_worth)||0).toFixed(2),debt=+(parseFloat(f.total_debt)||0).toFixed(2);
    var de=+(parseFloat(f.debt_equity_ratio)||(nw>0?debt/nw:0)).toFixed(2);
    var roe=+(parseFloat(f.roe)||0).toFixed(1),roce=+(parseFloat(f.roce)||0).toFixed(1);
    var netM=+(rev>0?pat/rev*100:0).toFixed(1);
    var cr2=+(parseFloat(f.current_ratio)||0).toFixed(2),intCov=+(parseFloat(f.interest_coverage)||0).toFixed(1);
    var assets=+(parseFloat(f.total_assets)||0).toFixed(2);
    var rev23=+(parseFloat(f.revenue_fy23)||0).toFixed(2),rev22=+(parseFloat(f.revenue_fy22)||0).toFixed(2);
    var yr24=f.fy24_year||'FY24',yr23lbl=f.fy23_year||'FY23',yr22lbl=f.fy22_year||'FY22';
    var fixYr=function(yr,d){var s=String(yr||'').replace(/FY/i,'').trim();var n=parseInt(s);if(isNaN(n))return d;if(n>=2000)n=n%100;return(n>=18&&n<=30)?'FY'+n:d;};
    yr24=fixYr(yr24,'FY24');yr23lbl=fixYr(yr23lbl,'FY23');yr22lbl=fixYr(yr22lbl,'FY22');
    var openChgs=chgs.filter(function(c){return c.status==='Open';}).length;
    var revGr=parseFloat(rev23)>0?+((rev-parseFloat(rev23))/parseFloat(rev23)*100).toFixed(1):0;

    var mults={Manufacturing:{pe:28,ev:16},Pharma:{pe:35,ev:22},'IT Services':{pe:40,ev:28},'Financial Services':{pe:18,ev:12},Infrastructure:{pe:22,ev:14},FMCG:{pe:45,ev:30},Other:{pe:25,ev:18}};
    var sm=mults[sector]||mults.Other,sPE=sm.pe,sEV=sm.ev;
    var disc=exchange.indexOf('SME')>-1?0.30:0.20;
    var pe_gross=+(pat*sPE).toFixed(1),pe_eq=+(pe_gross*(1-disc)).toFixed(1);
    var ev_ent=+(eCr*sEV).toFixed(1),ev_eq=+(Math.max(0,eCr*sEV-parseFloat(debt))).toFixed(1);
    var fcf=+(pat*0.65).toFixed(2),dcf=0,tv_val;
    for(var i=1;i<=5;i++) dcf+=fcf*Math.pow(1.15,i)/Math.pow(1.13,i);
    tv_val=+(fcf*Math.pow(1.15,5)*1.05/0.08/Math.pow(1.13,5)).toFixed(1);
    dcf=+(dcf+parseFloat(tv_val)).toFixed(1);
    var base=+(pe_eq*0.4+ev_eq*0.4+dcf*0.2).toFixed(1);
    var cons=+(base*0.80).toFixed(1),opti=+(base*1.25).toFixed(1);
    var shrsCr=Math.max(0.1,parseFloat(nw)/10);
    var pLow=Math.min(1500,Math.max(50,Math.round(parseFloat(cons)/shrsCr)));
    var pHigh=Math.min(2000,Math.max(60,Math.round(parseFloat(base)/shrsCr)));
    if(pHigh<=pLow)pHigh=Math.round(pLow*1.2);
    var score=0;
    if(roe>=20)score+=15;else if(roe>=12)score+=8;
    if(roce>=15)score+=15;else if(roce>=10)score+=8;
    if(rev>=50)score+=10;else if(rev>=20)score+=5;
    if(pat>=5)score+=10;if(nw>=10)score+=10;if(ePct>=15)score+=10;
    if(de<=1)score+=10;if(openChgs===0)score+=10;if(dirs.length>=3)score+=5;
    score=Math.min(100,score);
    var ipoColor=score>=75?'#1A6B3A':score>=50?'#E67E22':'#C0392B';
    var ipoRating=score>=75?'GREEN \u2014 IPO Ready':score>=50?'AMBER \u2014 Conditional':'RED \u2014 Not Ready';

    var fd='COMPANY: '+cname+' | CIN: '+cin+' | SECTOR: '+sector+' | TARGET: '+exchange+' | STATUS: PRIVATE UNLISTED'
      +'\n'+yr22lbl+' Rev=\u20b9'+rev22+' Cr | '+yr23lbl+' Rev=\u20b9'+rev23+' Cr | '+yr24+' Rev=\u20b9'+rev+' Cr ('+revGr+'% YoY)'
      +'\nPAT=\u20b9'+pat+' Cr ('+netM+'%) | EBITDA='+ePct+'% (\u20b9'+eCr+' Cr) | NW=\u20b9'+nw+' Cr | Debt=\u20b9'+debt+' Cr'
      +'\nROE='+roe+'% | ROCE='+roce+'% | D/E='+de+'x | Assets=\u20b9'+assets+' Cr'
      +'\nValuation: P/E=\u20b9'+pe_eq+' Cr | EV/EBITDA=\u20b9'+ev_eq+' Cr | DCF=\u20b9'+dcf+' Cr'
      +'\nBase=\u20b9'+base+' Cr | Conservative=\u20b9'+cons+' Cr | Optimistic=\u20b9'+opti+' Cr | PriceBand=\u20b9'+pLow+'-\u20b9'+pHigh;

    var sys='You are a Senior MD at Goldman Sachs / Morgan Stanley focused on Indian ECM. Write comprehensive investment banking intelligence with tables, specific data, and actionable insights.';

    setS('Business Intelligence (1/6)\u2026');
    var v1=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:fd+'\n\nSection 1 - COMPANY INTELLIGENCE & INVESTMENT THESIS:\n(1) Executive company snapshot table: Parameter|Detail\n(2) Business model and revenue composition\n(3) 4 key investment thesis points\n(4) Competitive moat assessment table: Factor|Strength|Score\n(5) Management track record and promoter credibility'}]});
    var vs1=(v1&&v1.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    setS('Financial Deep-Dive (2/6)\u2026');
    var v2=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:fd+'\n\nSection 2 - FINANCIAL INTELLIGENCE DEEP-DIVE:\n(1) P&L table: '+yr22lbl+'/'+yr23lbl+'/'+yr24+' with growth columns\n(2) DuPont ROE decomposition: '+roe+'% = Margin x Turnover x Leverage\n(3) EBITDA bridge analysis\n(4) Working capital efficiency analysis\n(5) FCF quality: PAT vs operating cash conversion\n(6) Balance sheet forensics and debt structure'}]});
    var vs2=(v2&&v2.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    setS('Valuation Analysis (3/6)\u2026');
    var v3=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:fd+'\n\nSection 3 - VALUATION DEEP-DIVE:\n(1) P/E: PAT '+pat+' x '+sPE+'x = '+pe_gross+' Cr gross - '+Math.round(disc*100)+'% = '+pe_eq+' Cr equity\n(2) EV/EBITDA: EBITDA '+eCr+' x '+sEV+'x = '+ev_ent+' EV - debt '+debt+' = '+ev_eq+' Cr equity\n(3) DCF: 5-yr FCF table, WACC 13%, terminal value '+tv_val+' Cr, total '+dcf+' Cr\n(4) Valuation summary table: Method|Value|Weight|Weighted\n(5) Sensitivity table: Growth rate +/-20% impact\n(6) Listing premium estimation methodology'}]});
    var vs3=(v3&&v3.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    setS('Peer Benchmarking (4/6)\u2026');
    var v4=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:fd+'\n\nSection 4 - PEER BENCHMARKING & INDUSTRY:\n(1) 8 listed peers: Company|NSE|Rev(Cr)|PAT|EBITDA%|PE|EV/EBITDA|ROE%|MktCap\n(2) '+cname+' vs peers: premium/discount analysis\n(3) '+sector+' sector TAM, CAGR, PLI schemes\n(4) Global comparables and India premium/discount\n(5) Re-rating catalysts and triggers'}]});
    var vs4=(v4&&v4.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    setS('Risk & Governance (5/6)\u2026');
    var v5=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:fd+'\n\nSection 5 - RISK INTELLIGENCE & GOVERNANCE:\n(1) Risk matrix: Risk|Category|Probability|Impact|Severity|Mitigation (10 rows)\n(2) '+openChgs+' open charges: impact on IPO, lender consent requirements\n(3) Board governance scorecard: '+dirs.length+' directors vs SEBI LODR requirements\n(4) ESG assessment table\n(5) Key person risk and succession planning'}]});
    var vs5=(v5&&v5.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    setS('Investment Verdict (6/6)\u2026');
    var v6=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:fd+'\n\nSection 6 - INVESTMENT VERDICT & IPO STRATEGY:\n(1) IPO readiness scorecard table: 12 parameters scored out of 10\n(2) Price band '+pLow+'-'+pHigh+'/share justification\n(3) GMP prediction and listing premium\n(4) Recommended investor profile and allocation %\n(5) SUBSCRIBE/NEUTRAL/AVOID verdict with score '+score+'/100\n(6) 12-month post-listing target and catalysts\n(7) Conditions that would change recommendation'}]});
    var vs6=(v6&&v6.content||[]).map(function(c){return c.text||'';}).join('').replace(/\[\w[\w ]*\]/g,'').trim();

    if(prog)prog.style.display='none';
    if(btn){btn.disabled=false;btn.innerHTML='&#128200; Generate Intelligence Valuation \xb7 \u20b97,999 \u2192';}
    var ac='#3B30B0';
    var report='<div style="font-family:Arial,sans-serif;max-width:920px;color:#1A2E35">';
    var reportDate=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
    report+='<div style="background:linear-gradient(135deg,#3B30B0,#5B4ED4);color:#fff;border-radius:14px;padding:26px 30px;margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">'
      +'<div><div style="font-size:9px;letter-spacing:2px;opacity:.6;text-transform:uppercase;margin-bottom:6px">VALUATION INTELLIGENCE · 6 SECTIONS · '+reportDate+'</div>'
      +'<div style="font-size:22px;font-weight:900">'+esc(cname)+'</div>'
      +'<div style="font-size:12px;opacity:.75;margin-top:4px">'+esc(sector)+' · Target: '+esc(exchange)+' · Private Unlisted</div></div>'
      +'<div style="text-align:center;min-width:80px">'
      +'<div style="font-size:40px;font-weight:900;color:'+ipoColor+';line-height:1">'+score+'</div>'
      +'<div style="font-size:10px;opacity:.7">/100 · '+ipoRating+'</div>'
      +'<button onclick="printReport(\'valintel\')" style="margin-top:6px;padding:4px 12px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-size:10px;cursor:pointer">&#128438; Print</button>'
      +'</div></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:10px;margin-bottom:12px">'
      +'<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:12px;text-align:center"><div style="font-size:9px;opacity:.6;text-transform:uppercase;margin-bottom:3px">Conservative</div><div style="font-size:20px;font-weight:900">₹'+cons+' Cr</div></div>'
      +'<div style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:10px;padding:12px;text-align:center"><div style="font-size:9px;opacity:.7;text-transform:uppercase;margin-bottom:3px">Base Case ★</div><div style="font-size:26px;font-weight:900">₹'+base+' Cr</div></div>'
      +'<div style="background:rgba(255,255,255,.1);border-radius:10px;padding:12px;text-align:center"><div style="font-size:9px;opacity:.6;text-transform:uppercase;margin-bottom:3px">Optimistic</div><div style="font-size:20px;font-weight:900">₹'+opti+' Cr</div></div>'
      +'</div>'
      +'<div style="text-align:center;font-size:13px;opacity:.85">Price Band: <strong>₹'+pLow+' – ₹'+pHigh+' per share</strong></div></div>';
        report+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
    [['Revenue ('+yr24+')','&#8377;'+rev+' Cr'],['PAT','&#8377;'+pat+' Cr'],['EBITDA%',ePct+'%'],['NW','&#8377;'+nw+' Cr'],
     ['ROE',roe+'%'],['ROCE',roce+'%'],['D/E',de+'x'],['Net Margin',netM+'%']].forEach(function(c){
      report+='<div style="background:#fff;border:1px solid #E0EAF0;border-left:3px solid #3B30B0;border-radius:8px;padding:10px 12px">'
        +'<div style="font-size:9px;color:#8A9AAB;text-transform:uppercase;margin-bottom:3px">'+c[0]+'</div>'
        +'<div style="font-size:15px;font-weight:800">'+c[1]+'</div></div>';
    });
    report+='</div>';
    // Valuation table
    report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:14px">'
      +'<div style="font-size:11px;font-weight:700;color:#3B30B0;text-transform:uppercase;margin-bottom:10px">Valuation Framework</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB">'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Method</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">Equity Value</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">Weight</th>'
      +'<th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:center">Weighted</th>'
      +'</tr></thead><tbody>'
      +'<tr><td style="padding:7px 10px;font-weight:600">P/E Multiple ('+sPE+'x)</td><td style="padding:7px 10px;text-align:center">\u20b9'+pe_eq+' Cr</td><td style="padding:7px 10px;text-align:center">40%</td><td style="padding:7px 10px;text-align:center">\u20b9'+(pe_eq*0.4).toFixed(1)+' Cr</td></tr>'
      +'<tr style="background:#FAFCFD"><td style="padding:7px 10px;font-weight:600">EV/EBITDA ('+sEV+'x)</td><td style="padding:7px 10px;text-align:center">\u20b9'+ev_eq+' Cr</td><td style="padding:7px 10px;text-align:center">40%</td><td style="padding:7px 10px;text-align:center">\u20b9'+(ev_eq*0.4).toFixed(1)+' Cr</td></tr>'
      +'<tr><td style="padding:7px 10px;font-weight:600">DCF (WACC 13%)</td><td style="padding:7px 10px;text-align:center">\u20b9'+dcf+' Cr</td><td style="padding:7px 10px;text-align:center">20%</td><td style="padding:7px 10px;text-align:center">\u20b9'+(dcf*0.2).toFixed(1)+' Cr</td></tr>'
      +'<tr style="background:#1A2E35;color:#fff"><td style="padding:8px 10px;font-weight:700">BASE VALUATION</td><td style="padding:8px 10px;text-align:center;font-weight:900;font-size:14px">\u20b9'+base+' Cr</td><td colspan="2" style="padding:8px 10px;text-align:center">Cons: \u20b9'+cons+' | Opti: \u20b9'+opti+'</td></tr>'
      +'</tbody></table></div>';
    // 6 AI sections
    var vSecs=[[vs1,'Company Intelligence & Investment Thesis','#EFF6FF','#1A5C8A'],
               [vs2,'Financial Intelligence Deep-Dive','#F0FFF4','#1A6B3A'],
               [vs3,'Valuation Deep-Dive Analysis','#F5F0FF','#5B4ED4'],
               [vs4,'Peer Benchmarking & Industry','#FFF5E8','#B5370A'],
               [vs5,'Risk Intelligence & Governance','#FFF5F0','#C0392B'],
               [vs6,'Investment Verdict & IPO Strategy','#F0F5FF','#1A3A8A']];
    vSecs.forEach(function(s,idx){
      if(!s[0]||s[0].length<10) return;
      report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;overflow:hidden;margin-bottom:14px">'
        +'<div style="background:'+s[3]+';padding:10px 16px;display:flex;align-items:center;gap:10px">'
        +'<div style="width:24px;height:24px;background:rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">'+(idx+1)+'</div>'
        +'<div style="font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.3px">'+s[1]+'</div>'
        +'</div><div style="padding:16px 18px;background:'+s[2]+'" class="ai-body">'+md2html(s[0])+'</div></div>';
    });
    if(dirs.length){
      report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:12px">'
        +'<div style="font-size:11px;font-weight:700;color:#3B30B0;text-transform:uppercase;margin-bottom:8px">Board of Directors</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB"><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Name</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Designation</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">DIN</th></tr></thead><tbody>';
      dirs.forEach(function(d,i){report+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'"><td style="padding:7px 10px;font-weight:600">'+esc(d.name||'')+'</td><td style="padding:7px 10px">'+esc(d.designation||'')+'</td><td style="padding:7px 10px;color:#6B8A94;font-size:11px">'+esc(d.din||'')+'</td></tr>';});
      report+='</tbody></table></div>';
    }
    report+='<div style="padding:8px 14px;background:#F8F9FA;border-radius:6px;font-size:10px;color:#9AB0B8">ipowork not SEBI-registered. Informational only. \u00a9 2025</div></div>';
    if(out){out.innerHTML=report;out.scrollIntoView({behavior:'smooth',block:'start'});}
    var res={_report:report,company_name:cname,cin:cin,sector:sector,exchange:exchange,
      val_base_cr:base,val_conservative_cr:cons,val_optimistic_cr:opti,price_band_low:pLow,price_band_high:pHigh,ipo_score:score};
    AIRA_RESULTS['valintel']={result:res,cname:cname,sector:sector,tier:'valintel'};
    saveReportToStore('valintel',cname,sector,res);
    updateFullReportBtn();
  }catch(e){
    if(prog)prog.style.display='none';
    if(btn){btn.disabled=false;btn.innerHTML='&#128200; Generate Intelligence Valuation \xb7 \u20b97,999 \u2192';}
    if(out)out.innerHTML='<div class="err-card"><b>Error:</b> '+esc(e.message)+'</div>';
  }
}

async function runDeepResearchFull(){
  var cin=(document.getElementById('dr-cin')||{}).value||'';
  cin=cin.trim().toUpperCase();
  var sector=(document.getElementById('dr-sector')||{}).value||'Manufacturing';
  var exchange=(document.getElementById('dr-exchange')||{}).value||'NSE Main Board';
  var depth=(document.getElementById('dr-depth')||{}).value||'standard';
  if(!cin){alert('Please enter CIN.');return;}
  var btn=document.getElementById('btn-dr-run'),prog=document.getElementById('prog-deepresearch'),out=document.getElementById('result-deepresearch');
  if(btn){btn.disabled=true;}
  if(out)out.innerHTML='<div style="padding:30px;text-align:center;font-family:\'Segoe UI\',Arial,sans-serif"><div class="status-msg" style="font-size:14px;font-weight:700;color:#3B30B0;margin-bottom:12px">Deep Research Engine Starting\u2026</div><div style="background:#F0EEFF;border-radius:8px;padding:2px;margin-bottom:12px"><div class="dr-progress-bar" style="background:linear-gradient(90deg,#3B30B0,#5B4ED4);height:8px;border-radius:6px;width:3%;transition:width .5s"></div></div><div id="dr-status-text" style="font-size:12px;color:#6B8A94"></div></div>';
  if(prog)prog.style.display='flex';

  var tokPerMod=depth==='quick'?800:depth==='deep'?1400:1100;
  var modCount=depth==='quick'?8:depth==='deep'?15:12;

  var setPct=function(pct,msg){
    if(btn)btn.innerHTML='<span class="spinner"></span> ['+pct+'%] '+msg;
    var pb=out&&out.querySelector('.dr-progress-bar');if(pb)pb.style.width=pct+'%';
    var st=out&&out.querySelector('#dr-status-text');if(st)st.textContent=msg;
  };

  try{
    setPct(3,'Fetching company data from Probe42\u2026');
    var p42=await workerPost({type:'probe42_raw',cin:cin});
    var cname=(p42&&p42.company_name&&p42.company_name!=='NOT FOUND')?p42.company_name:cin;
    var f=(p42&&p42.financials)||{},dirs=(p42&&p42.directors)||[],chgs=(p42&&p42.charges)||[];

    // ══════════════════════════════════════════════════════════════════════
    // SINGLE SOURCE OF TRUTH — ALL FIGURES PRE-COMPUTED IN JS
    // AI must use these exact values. No independent calculations allowed.
    // ══════════════════════════════════════════════════════════════════════

    var rev    = +(parseFloat(f.revenue_fy24)||0).toFixed(2);
    var rev23  = +(parseFloat(f.revenue_fy23)||0).toFixed(2);
    var rev22  = +(parseFloat(f.revenue_fy22)||0).toFixed(2);
    var pat    = +(parseFloat(f.pat_fy24)||0).toFixed(2);
    var pat23  = +(parseFloat(f.pat_fy23)||0).toFixed(2);
    var pat22  = +(parseFloat(f.pat_fy22)||0).toFixed(2);  // LOCKED — never changes
    var ePct   = +(parseFloat(f.ebitda_margin)||0).toFixed(2);
    var eCr    = +(parseFloat(f.ebitda_cr)||(rev*ePct/100)||0).toFixed(2);
    var ebitda23 = +(parseFloat(f.ebitda_fy23)||0).toFixed(2);
    var ebitda22 = +(parseFloat(f.ebitda_fy22)||0).toFixed(2);
    var nw     = +(parseFloat(f.net_worth)||0).toFixed(2);
    var debt   = +(parseFloat(f.total_debt)||0).toFixed(2);
    var de     = +(parseFloat(f.debt_equity_ratio)||(nw>0?debt/nw:0)).toFixed(2);
    var roe    = +(parseFloat(f.roe)||0).toFixed(2);
    var roce   = +(parseFloat(f.roce)||0).toFixed(2);
    var netM   = +(rev>0?pat/rev*100:0).toFixed(2);
    var cr2    = +(parseFloat(f.current_ratio)||0).toFixed(2);
    var intCov = +(parseFloat(f.interest_coverage)||0).toFixed(2);
    var assets = +(parseFloat(f.total_assets)||0).toFixed(2);
    var cashflow = +(parseFloat(f.operating_cashflow)||0).toFixed(2);
    var website  = (p42&&p42.website)||'';
    var pbt    = +(parseFloat(f.pbt_fy24)||parseFloat(f.profit_before_tax)||0).toFixed(2);
    var ebit   = +(parseFloat(f.ebit_fy24)||0).toFixed(2);
    var revenue_other = +(parseFloat(f.other_income)||0).toFixed(2);
    var tax    = +(parseFloat(f.tax_fy24)||0).toFixed(2);

    var yr24=f.fy24_year||'FY24',yr23lbl=f.fy23_year||'FY23',yr22lbl=f.fy22_year||'FY22';
    var fixYr=function(yr,d){var s=String(yr||'').replace(/FY/i,'').trim();var n=parseInt(s);if(isNaN(n))return d;if(n>=2000)n=n%100;return(n>=18&&n<=30)?'FY'+n:d;};
    yr24=fixYr(yr24,'FY24');yr23lbl=fixYr(yr23lbl,'FY23');yr22lbl=fixYr(yr22lbl,'FY22');

    var openChgs = chgs.filter(function(c){return c.status==='Open';}).length;

    // ── CAGRs — COMPUTED ONCE, LOCKED ────────────────────────────────────
    var rev2yrCagr = (rev22>0&&rev22!==rev) ? +(Math.pow(rev/rev22,0.5)*100-100).toFixed(2) : (rev23>0&&rev23!==rev ? +(rev/rev23*100-100).toFixed(2) : 'N/A');
    var pat2yrCagr = (pat22>0&&pat22!==pat) ? +(Math.pow(pat/pat22,0.5)*100-100).toFixed(2) : (pat23>0&&pat23!==pat ? +(pat/pat23*100-100).toFixed(2) : 'N/A');
    var hasHistorical = (rev22>0&&rev22!==rev) || (rev23>0&&rev23!==rev); // flag if no real historical data
    var revYoY     = rev23>0  ? +(( rev -rev23)/rev23*100).toFixed(2) : 0;
    var patYoY     = pat23>0  ? +((pat -pat23)/pat23*100).toFixed(2) : 0;
    var ebitdaYoY  = ebitda23>0 ? +((eCr-ebitda23)/ebitda23*100).toFixed(2) : 0;
    var ebitdaMChg = ebitda23>0&&rev23>0 ? +(ePct-(ebitda23/rev23*100)).toFixed(2) : 0; // bps movement

    // ── DUPONT DECOMPOSITION — JS COMPUTED ──────────────────────────────
    // ROE = Net Margin × Asset Turnover × Equity Multiplier
    var assetTurnover   = assets>0 ? +(rev/assets).toFixed(3) : 0;
    var equityMultiplier= nw>0    ? +(assets/nw).toFixed(3) : 0;
    var roeCheck        = +(netM * assetTurnover * equityMultiplier).toFixed(2); // should ≈ roe

    // ROCE = EBIT / Capital Employed;  CE = Assets - Current Liabilities (approx = NW + Debt)
    var capEmployed = +(parseFloat(nw)+parseFloat(debt)).toFixed(2);
    var ebitFromRoce= +(roce/100*capEmployed).toFixed(2); // back-calculated EBIT from ROCE
    // Interest expense = EBIT - PBT (CORRECT method)
    var interestExpense = (ebit>0&&pbt>0) ? +(ebit-pbt).toFixed(2) :
                          (ebitFromRoce>0&&pbt>0) ? +(ebitFromRoce-pbt).toFixed(2) :
                          +(parseFloat(debt)*0.10).toFixed(2); // fallback: 10% of debt
    // Tax = PBT - PAT
    var taxExpense = (pbt>0) ? +(pbt-pat).toFixed(2) : +(pat*0.25).toFixed(2);
    var effTaxRate = (pbt>0) ? +(taxExpense/pbt*100).toFixed(1) : 25;

    // ── CASH FLOW (reconstruct if OCF not in Probe42) ───────────────────
    var ocf      = cashflow>0 ? cashflow : +(pat*1.15).toFixed(2); // approx: PAT + D&A
    var capex    = +(parseFloat(f.capex)||assets*0.05||0).toFixed(2); // estimate 5% of assets
    var fcfEst   = +(ocf - capex).toFixed(2);
    var ocfPat   = pat>0 ? +(ocf/pat).toFixed(2) : 'N/A'; // OCF/PAT ratio (quality check)
    var cashNote = cashflow>0 ? 'from Probe42' : 'estimated (PAT + D&A proxy)';

    // ── WORKING CAPITAL (estimated) ──────────────────────────────────────
    var dso = +(rev>0 ? 90 : 0); // placeholder — will be refined by AI from website
    var nwcEst = +(rev*0.15).toFixed(2); // rough NWC = 15% revenue

    // ── VALUATION (computed once) ─────────────────────────────────────────
    var mults={Manufacturing:{pe:28,ev:16},Pharma:{pe:35,ev:22},'IT Services':{pe:40,ev:28},'Financial Services':{pe:18,ev:12},Infrastructure:{pe:22,ev:14},FMCG:{pe:45,ev:30},Other:{pe:25,ev:18}};
    var sm=mults[sector]||mults.Other, sPE=sm.pe, sEV=sm.ev;
    var disc=exchange.indexOf('SME')>-1?0.30:0.20;
    var pe_eq   = +(pat*sPE*(1-disc)).toFixed(1);
    var ev_eq   = +(Math.max(0,eCr*sEV-parseFloat(debt))).toFixed(1);
    var fcfDCF  = +(pat*0.65).toFixed(2), dcfVal=0, tvVal;
    for(var i=1;i<=5;i++) dcfVal+=fcfDCF*Math.pow(1.15,i)/Math.pow(1.13,i);
    tvVal   = +(fcfDCF*Math.pow(1.15,5)*1.05/0.08/Math.pow(1.13,5)).toFixed(1);
    dcfVal  = +(dcfVal+parseFloat(tvVal)).toFixed(1);
    var pbVal   = +(nw*1.5).toFixed(1);
    var baseVal = +(pe_eq*0.4+ev_eq*0.4+dcfVal*0.2).toFixed(1);

    // ── SECTOR FLAGS ──────────────────────────────────────────────────────
    var isNBFC = sector==='Financial Services' || ['FINANCE','NBFC','CREDIT','LENDING','CAPITAL','MICRO'].some(function(k){return cname.toUpperCase().indexOf(k)>=0;});
    var isPharma = sector==='Pharma';
    var isIT = sector==='IT Services';

    // ── IPO SCORE ─────────────────────────────────────────────────────────
    var score=0;
    if(roe>=20)score+=15;else if(roe>=12)score+=8;
    if(roce>=15)score+=15;else if(roce>=10)score+=8;
    if(rev>=50)score+=10;else if(rev>=20)score+=5;
    if(pat>=5)score+=10;if(nw>=10)score+=10;if(ePct>=15||isNBFC)score+=10;
    if(de<=1)score+=10;if(openChgs===0)score+=10;if(dirs.length>=3)score+=5;
    score=Math.min(100,score);
    var ipoColor=score>=75?'#1A6B3A':score>=50?'#E67E22':'#C0392B';

    // ══════════════════════════════════════════════════════════════════════
    // THE LOCKED DATA BLOCK — passed verbatim to all 15 modules
    // AI is FORBIDDEN from computing any figure that contradicts this block
    // ══════════════════════════════════════════════════════════════════════
    var VERIFIED_FINANCIALS=(
      '\n\n╔══════════════════════════════════════════════════════════════╗'
      +'\n║  LOCKED FINANCIAL DATA — DO NOT CONTRADICT ANY FIGURE HERE  ║'
      +'\n╚══════════════════════════════════════════════════════════════╝'
      +'\n'
      +'\nP&L STATEMENT (₹ Crore) — only available years shown, DO NOT repeat FY24 for missing years:'
      +'\n  Revenue:  '+yr22lbl+'='+(rev22>0?rev22:'DATA UNAVAILABLE')+'  '+yr23lbl+'='+(rev23>0?rev23:'DATA UNAVAILABLE')+'  '+yr24+'='+rev
      +'\n  EBITDA:   '+yr22lbl+'='+(ebitda22>0?ebitda22:'N/A')+'  '+yr23lbl+'='+(ebitda23>0?ebitda23:'N/A')+'  '+yr24+'='+eCr+' (margin '+ePct+'%)'
      +'\n  PAT:      '+yr22lbl+'='+(pat22>0?pat22:'DATA UNAVAILABLE')+'  '+yr23lbl+'='+(pat23>0?pat23:'DATA UNAVAILABLE')+'  '+yr24+'='+pat+' (net margin '+netM+'%)'
      +'\n  RULE: If a year shows DATA UNAVAILABLE, write "Data not available" for that year. DO NOT carry forward FY24 figures.'
      +'\n'
      +'\nCAGRs (use ONLY these, never recompute):'
      +'\n  Revenue 2yr CAGR: '+rev2yrCagr+'%  |  Revenue YoY: '+revYoY+'%'
      +'\n  PAT 2yr CAGR: '+pat2yrCagr+'%  |  PAT YoY: '+patYoY+'%'
      +'\n  EBITDA margin change YoY: '+ebitdaMChg+' percentage points'
      +'\n'
      +'\nDUPONT ROE DECOMPOSITION (pre-computed — do not recalculate):'
      +'\n  ROE = '+roe+'%  = Net Margin '+netM+'% × Asset Turnover '+assetTurnover+'x × Equity Multiplier '+equityMultiplier+'x'
      +'\n  EBIT (back-calc from ROCE): ₹'+ebitFromRoce+' Cr'
      +'\n  Interest Expense (EBIT−PBT): ₹'+interestExpense+' Cr  [NOT finance costs × rate]'
      +'\n  PBT: ₹'+pbt+' Cr  |  Tax: ₹'+taxExpense+' Cr ('+effTaxRate+'% effective rate)'
      +'\n'
      +'\nCASH FLOW ('+cashNote+'):'
      +'\n  Operating CF: ₹'+ocf+' Cr  |  CapEx est.: ₹'+capex+' Cr  |  FCF est.: ₹'+fcfEst+' Cr'
      +'\n  OCF/PAT ratio: '+ocfPat+'x  '+( parseFloat(ocfPat)>=0.8?'(strong cash conversion)':parseFloat(ocfPat)>=0.5?'(moderate)':'(review working capital)' )
      +'\n'
      +'\nBALANCE SHEET:'
      +'\n  Net Worth: ₹'+nw+' Cr  |  Total Debt: ₹'+debt+' Cr  |  D/E: '+de+'x'
      +'\n  Total Assets: ₹'+assets+' Cr  |  Capital Employed: ₹'+capEmployed+' Cr'
      +'\n'
      +'\nRATIOS:'
      +'\n  ROE: '+roe+'%  |  ROCE: '+roce+'%  |  Int Coverage: '+intCov+'x'
      +'\n  Current Ratio: '+cr2+'x  |  Net Margin: '+netM+'%'
      +'\n'
      +'\nVALUATION (computed in JS — use exactly):'
      +'\n  P/E ('+sPE+'x, '+Math.round(disc*100)+'% disc): ₹'+pe_eq+' Cr'
      +'\n  EV/EBITDA ('+sEV+'x): ₹'+ev_eq+' Cr'
      +'\n  DCF (WACC 13%, g 5%): ₹'+dcfVal+' Cr  |  Terminal Value: ₹'+tvVal+' Cr'
      +'\n  P/B (1.5x book): ₹'+pbVal+' Cr'
      +'\n  BASE VALUATION (40/40/20 weighted): ₹'+baseVal+' Cr'
      +'\n'
      +(isNBFC
      ?'\nNBFC/LENDING COMPANY — MANDATORY FIELDS (RBI + SEBI ICDR requirement):'
       +'\n  These MUST appear in every financial module or be explicitly flagged as data gaps:'
       +'\n  GNPA% (Gross NPA as % of loan book)'
       +'\n  NNPA% (Net NPA after provisions)'
       +'\n  CRAR% (Capital Adequacy Ratio — RBI minimum 15%)'
       +'\n  NIM% (Net Interest Margin = Yield on Advances − Cost of Funds)'
       +'\n  AUM breakup by product (secured/unsecured, segment-wise)'
       +'\n  PCR% (Provision Coverage Ratio)'
       +'\n  If any metric is unavailable from Probe42 data, write: "[DATA GAP: X not available — management to confirm before DRHP filing]"'
       +'\n  DO NOT use equity multiplier benchmarks appropriate for manufacturing companies — NBFC D/E of 3-7x is NORMAL and REGULATED.\n'
      :'')
      +'╔══════════════════════════════════════════════════════════════╗'
      +'\n║              END LOCKED DATA                                 ║'
      +'\n'
      +'\nDATA QUALITY FLAGS:'
      +((!rev22||rev22===rev)?'\n  ⚠ FY22 revenue unavailable from MCA — do not fabricate or repeat FY24 figure':'\n  ✓ FY22 revenue available')
      +((!rev23||rev23===rev)?'\n  ⚠ FY23 revenue unavailable from MCA — write "Not Available" in tables':'\n  ✓ FY23 revenue available')
      +((!pat22||pat22===pat)?'\n  ⚠ FY22 PAT unavailable — do not repeat FY24 PAT figure':'\n  ✓ FY22 PAT available')
      +'\n  Charge register: '+chgs.length+' charges — lender names from MCA only (not inferred)'
      +(isNBFC?'\n  ⚠ NBFC: NPA/CRAR/NIM not in Probe42 — must be sourced from website or flagged as data gap':'')
      +'\n╚══════════════════════════════════════════════════════════════╝'
    );

    var fd='COMPANY: '+cname+' | CIN: '+cin+' | SECTOR: '+sector+' | TARGET: '+exchange+' | STATUS: PRIVATE UNLISTED (Pre-IPO)'
      +VERIFIED_FINANCIALS;

    var sys='You are a Senior SEBI-registered IPO Analyst and Merchant Banker. Do NOT attribute this analysis to any specific firm (McKinsey, KPMG, Goldman Sachs, etc.) as that would be misleading. Write detailed, data-driven analysis using ONLY the verified financial data provided. CRITICAL: Use exact figures given — never contradict them. Every CAGR, margin, ratio must match the verified data exactly. Write tables, cite specific regulations, provide actionable insights.';

    // ── SECTOR-SPECIFIC MODULE OVERRIDES ───────────────────────────────
    var nbfcOverride={
      M04:'Write Section M04 - FINANCIAL PERFORMANCE (NBFC-specific):\n(1) P&L table: '+yr22lbl+'/'+yr23lbl+'/'+yr24+' — NII, PBT, PAT using VERIFIED figures above\n(2) NIM (Net Interest Margin) analysis — estimated if not provided\n(3) GNPA / NNPA % trend (request from management if unavailable — flag as CRITICAL gap)\n(4) Capital Adequacy Ratio (CRAR) vs RBI 15% minimum (flag if unavailable)\n(5) AUM breakup by product type — estimate from available data\n(6) Cost of funds vs yield on advances spread analysis\n(7) Provision Coverage Ratio assessment',
      M05:'Write Section M05 - BALANCE SHEET (NBFC-specific):\n(1) Asset quality: loan book composition, secured vs unsecured %\n(2) Borrowing profile: bank lines, NCD, sub-debt, ECB breakdown\n(3) ALM (Asset-Liability Mismatch) risk assessment\n(4) Tier 1 and Tier 2 capital structure\n(5) Off-balance sheet exposures\n(6) Liquidity coverage analysis'
    };

    // ── ALL 15 MODULES ─────────────────────────────────────────────────
    var allModules=[
      {id:'M01',t:'Executive Intelligence Summary',p:fd+'\n\nWrite M01 - EXECUTIVE INTELLIGENCE SUMMARY:\n(1) Company snapshot table: Metric|Value|Benchmark (10 rows)\n(2) Investment thesis: 4 compelling reasons to IPO now\n(3) IPO readiness scorecard: Score '+score+'/100 — breakdown by dimension\n(4) Key financial highlights table using VERIFIED data\n(5) Material concerns: top 3 risks an investor would flag\n(6) Recommendation: IPO-Ready / Conditional / Deferred with justification'},
      {id:'M02',t:'Business Model & Competitive Analysis',p:fd+'\n\nWrite M02 - BUSINESS MODEL & COMPETITIVE ANALYSIS:\n(1) Revenue streams table: Stream|%Share|Margin|Sustainability\n(2) Products/services portfolio with pricing power assessment\n(3) Customer concentration: top clients, % of revenue, contract terms\n(4) Supplier concentration and supply chain resilience\n(5) Porter\'s 5 Forces analysis table for '+sector+'\n(6) Competitive moat assessment: Moat|Strength(1-10)|Durability\n(7) Key differentiators vs unlisted and listed peers'},
      {id:'M03',t:'Market & Industry Intelligence',p:fd+'\n\nWrite M03 - MARKET & INDUSTRY INTELLIGENCE:\n(1) TAM/SAM/SOM sizing with bottom-up methodology\n(2) Market growth drivers table: Driver|Impact(H/M/L)|Timeline|Beneficiary\n(3) Government policy: PLI, sector-specific schemes, regulatory tailwinds\n(4) Competitive landscape: 8 listed peers with market cap and multiples\n(5) India vs global market comparison\n(6) 5-year sector growth projections with cited source\n'+(websiteCtx?'(7) Company positioning per website — specific products/markets mentioned':'(7) Estimate company market share from revenue vs TAM')},
      {id:'M04',t:'Financial Performance Deep-Dive',p:fd+'\n\n'+(isNBFC?nbfcOverride.M04:'Write M04 - FINANCIAL PERFORMANCE DEEP-DIVE:\n(1) 3-year P&L reconstruction table: '+yr22lbl+'/'+yr23lbl+'/'+yr24+' — Revenue/EBITDA/PAT — using VERIFIED figures ONLY\n(2) Revenue CAGR: MUST use '+rev2yrCagr+'% (2-year, '+yr22lbl+'-'+yr24+') — do not compute differently\n(3) DuPont ROE analysis: '+roe+'% = Net Margin '+netM+'% × Asset Turnover × Equity Multiplier\n(4) EBITDA bridge: Revenue → Gross Profit → EBITDA → EBIT → PBT → PAT — reconcile to \u20b9'+pat+' Cr PAT\n(5) Working capital efficiency: estimated DSO, DPO, DIO, Cash Conversion Cycle\n(6) FCF quality: Operating CF \u20b9'+cashflow+' Cr vs PAT \u20b9'+pat+' Cr — conversion ratio and quality analysis\n(7) Financial red flags screening: 5 items checked')},
      {id:'M05',t:'Balance Sheet & Capital Structure',p:fd+'\n\n'+(isNBFC?nbfcOverride.M05:'Write M05 - BALANCE SHEET & CAPITAL STRUCTURE:\n(1) Asset composition table: Fixed Assets/Current Assets/Investments/Other — % share\n(2) Liability structure: Bank Debt/Bonds/Trade Payables/Other\n(3) Net Worth \u20b9'+nw+' Cr adequacy vs listing requirements\n(4) Debt profile: '+openChgs+' open charges — lender-wise amounts (from MCA filings)\n(5) Debt serviceability: Interest Coverage '+intCov+'x — stress test at rates +200bps\n(6) Post-IPO capital structure: target D/E after fresh issue proceeds\n(7) Off-balance sheet items: guarantees, contingent liabilities')},
      {id:'M06',t:'Return Metrics & Shareholder Value',p:fd+'\n\nWrite M06 - RETURN METRICS (use ONLY pre-computed DuPont values from locked data):\n(1) DuPont ROE table: ROE '+roe+'% = Net Margin '+netM+'% × Asset Turnover '+assetTurnover+'x × Equity Multiplier '+equityMultiplier+'x — show each component and trend\nCRITICAL: Interest expense = EBIT − PBT = ₹'+interestExpense+' Cr. DO NOT compute interest as Debt × rate or EBITDA × rate.\n(2) ROCE '+roce+'% decomposition: EBIT ₹'+ebitFromRoce+' Cr ÷ Capital Employed ₹'+capEmployed+' Cr\n(3) EVA: ROCE '+roce+'% − WACC 13% = '+(+(parseFloat(roce)-13).toFixed(2))+'% spread × ₹'+capEmployed+' Cr = ₹'+(+(capEmployed*(parseFloat(roce)-13)/100).toFixed(1))+' Cr value created\n(4) Cash conversion quality: OCF ₹'+ocf+' Cr vs PAT ₹'+pat+' Cr = '+ocfPat+'x ratio (quality assessment)\n(5) Historical ROE/ROCE trend table: '+yr22lbl+'/'+yr23lbl+'/'+yr24+' — use locked figures only\n(6) 8 listed '+sector+' peers: Company|ROE|ROCE|Net Margin|Asset Turn|EV Multiplier\n(7) Value creation scorecard: 5 metrics GREEN/AMBER/RED with specific thresholds'},
      {id:'M07',t:'Governance & Board Assessment',p:fd+'\n\nWrite M07 - GOVERNANCE & BOARD ASSESSMENT:\n(1) Board composition scorecard: '+dirs.length+' total directors — Independence ratio vs SEBI LODR Reg 17\n(2) Director-by-director table: Name|DIN|Independence|Qualification|Other Directorships\nCRITICAL: Only mark as Independent if DIN is provided and confirmed. Unknown directors = mark as "Details Pending" NOT as Independent. Overstating board independence is an ICDR violation.\n(3) Board committees: Audit/NRC/CSR/Risk — status vs LODR requirements\n(4) Related party transactions: assessment and arm\'s-length compliance\n(5) Promoter shareholding and pledge status\n(6) Governance maturity matrix: Dimension|Current|Required|Gap|Timeline\n(7) Pre-IPO governance action plan with SEBI ICDR deadlines'},
      {id:'M08',t:'Regulatory & Compliance Deep-Dive',p:fd+'\n\nWrite M08 - REGULATORY & COMPLIANCE:\n(1) SEBI ICDR Regulation 6 eligibility checklist: full table all criteria\n(2) MCA/ROC compliance: Annual returns, ROC forms, filing status\n(3) Tax compliance: Income Tax, GST, TDS, transfer pricing\n(4) Labour law: PF, ESI, Shops & Establishments\n(5) Industry-specific: '+sector+' licences, certifications, regulatory approvals'+(isNBFC?' + RBI Certificate of Registration, SBR compliance, Fair Practices Code':'')+'\n(6) Environmental: factory/premises approvals, PCB NOC if applicable\n(7) Litigation screening: civil, criminal, regulatory — materiality assessment'},
      {id:'M09',t:'IPO Valuation Assessment',p:fd+'\n\nWrite M09 - IPO VALUATION (use ONLY the pre-computed values):\n(1) P/E Valuation: PAT \u20b9'+pat+' Cr × '+sPE+'x sector PE × (1-'+Math.round(disc*100)+'% discount) = \u20b9'+pe_eq+' Cr equity\n(2) EV/EBITDA: EBITDA \u20b9'+eCr+' Cr × '+sEV+'x - Debt \u20b9'+debt+' Cr = \u20b9'+ev_eq+' Cr equity\n(3) DCF (WACC 13%, g=5%): 5-yr FCF table, terminal value \u20b9'+tvVal+' Cr, equity = \u20b9'+dcfVal+' Cr\n(4) P/B Method: Book Value \u20b9'+nw+' Cr × 1.5x sector avg = \u20b9'+pbVal+' Cr\n(5) Weighted valuation table: Method|Equity Value|Weight|Weighted (Base = \u20b9'+baseVal+' Cr)\n(6) Sensitivity analysis: ±20% PAT / ±2x multiple impact on valuation table\n(7) Peer multiples table: 6 listed '+sector+' companies P/E, EV/EBITDA, P/B, ROE\n(8) Price band per share: if shares outstanding unknown, use Net Worth ₹'+nw+' Cr as proxy for market cap denominator. CRITICAL UNIT: equity value is in CRORES. To get price per share = (Equity Value Cr × 10,000,000) ÷ (shares outstanding). DO NOT mix crore and rupee units.\n(9) State shares outstanding assumption explicitly. If unknown, note it clearly.\nDo NOT invent different valuation figures. Use only the pre-computed values above.'},
      {id:'M10',t:'Risk Intelligence Matrix',p:fd+'\n\nWrite M10 - RISK INTELLIGENCE MATRIX:\n(1) Full risk register: Risk|Category|Probability(H/M/L)|Impact(H/M/L)|Severity|Mitigation|Owner (12 rows minimum)\n(2) Top 3 critical risks: detailed analysis each with financial quantification\n(3) '+sector+'-specific regulatory risks'+(isNBFC?' — RBI rate actions, NPA deterioration, funding squeeze':'')+'  \n(4) Governance risks: '+openChgs+' open charges, '+dirs.length+' director board gap analysis\n(5) Macro risks: interest rate, FX, competition, demand\n(6) Post-IPO risks: lock-in expiry, promoter selling pressure, earnings miss'},
      {id:'M11',t:'Due Diligence Checklist (SEBI ICDR)',p:fd+'\n\nWrite M11 - COMPLETE DUE DILIGENCE CHECKLIST (mark ALL as Done/Pending/N/A):\n(1) Financial DD — 15 items: audited financials 3yr, restatements, revenue recognition, working capital, off-balance sheet\n(2) Legal DD — 10 items: title deeds, IP, litigation, material contracts, change of control\n(3) Tax DD — 8 items: direct tax, GST, TDS, transfer pricing, DTA/DTL\n(4) Business/Commercial DD — 10 items: customer contracts, supplier agreements, order book\n(5) HR/People DD — 6 items: key man, ESOP, labour compliance, PF/ESI\n(6) Technical/Operational DD — 6 items: plant visit, capacity utilization, tech systems\n(7) Priority matrix: Critical(must close before filing) | High | Medium\nDo not leave items as Pending without explanation. All 55 items must have a status.'},
      {id:'M12',t:'SWOT & Strategic Analysis',p:fd+'\n\nWrite M12 - SWOT & STRATEGIC ANALYSIS:\n(1) SWOT table: 5 specific items per quadrant with financial data support\n(2) TOWS matrix: SO/ST/WO/WT strategies — 2 each with specific actions\n(3) Post-IPO growth strategy: capex deployment plan, capacity expansion\n(4) Product/geography expansion roadmap with revenue targets\n(5) Technology and digital transformation plan'+(websiteCtx?'\n(6) Strategic priorities from company website — validate against financial capability':'')},
      {id:'M13',t:'Listed Peer Benchmarking',p:fd+'\n\nWrite M13 - PEER BENCHMARKING:\n(1) Peer selection criteria and methodology\n(2) 8 listed '+sector+' peers table: Company|NSE Code|Rev(Cr)|PAT Margin%|EBITDA%|P/E|EV/EBITDA|ROE%|P/B|Mkt Cap(Cr)\n(3) '+cname+' positioning: % premium/discount to peer median — JUSTIFIED\n(4) Financial metrics benchmarking: 10 ratios vs peer median, p25, p75\n(5) Operational benchmarks: asset turns, employee productivity if applicable\n(6) Valuation gap: implied upside/downside at peer multiples vs computed \u20b9'+baseVal+' Cr'},
      {id:'M14',t:'IPO Process Roadmap',p:fd+'\n\nWrite M14 - COMPLETE IPO PROCESS ROADMAP (all items required):\n(1) Phase timeline table: Phase|Activities|Duration|Owner|Dependencies|Status\n    Phase 1: Pre-filing preparation (weeks 1-12)\n    Phase 2: DRHP preparation and filing (weeks 8-20)\n    Phase 3: SEBI review and observations (weeks 16-32)\n    Phase 4: RHP, pricing, marketing (weeks 28-38)\n    Phase 5: Issue open, allotment, listing (weeks 36-42)\n(2) Estimated total timeline: Optimistic/Base/Conservative (months)\n(3) IPO Structure recommendation: Fresh issue vs OFS split, rationale\n(4) Use of Proceeds: how fresh issue funds will be deployed (5 items with \u20b9 amounts)\n(5) Pre-IPO restructuring: specific actions, timeline, responsible party\n(6) DRHP preparation checklist: 20 key documents/disclosures required\n(7) Post-listing obligations: quarterly results, LODR, analyst meets'},
      {id:'M15',t:'Investment Verdict & Final Recommendation',p:fd+'\n\nWrite M15 - COMPLETE INVESTMENT VERDICT (must be fully concluded — no truncation):\n(1) Final IPO readiness scorecard: 12 parameters, score out of 10 each, total /120\n(2) Financial health verdict: Revenue CAGR '+rev2yrCagr+'%, ROE '+roe+'%, PAT \u20b9'+pat+' Cr — Excellent/Good/Average/Poor\n(3) Valuation verdict: Base \u20b9'+baseVal+' Cr — Fair/Overvalued/Undervalued vs peers\n(4) Top 5 investment positives (with specific financial evidence)\n(5) Top 5 risks and mitigants\n(6) CONDITIONS TO SUBSCRIBE — specific pre-conditions if any\n(7) Final verdict: SUBSCRIBE / AVOID / SUBSCRIBE WITH CONDITIONS\n(8) 12-month post-listing target: price range and catalysts\n(9) Red lines: 3 conditions that would change recommendation to AVOID\nThis section MUST have a clear final verdict. Do not end without the verdict.'}
    ];

    var activeModules=allModules.slice(0,modCount);
    var results=[];

    for(var mi=0;mi<activeModules.length;mi++){
      var mod=activeModules[mi];
      var pct=Math.round(10+(mi/activeModules.length)*82);
      setPct(pct,'Module '+(mi+1)+'/'+activeModules.length+': '+mod.t+'\u2026');
      try{
        var mr=await workerPost({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:tokPerMod,
          system:sys,messages:[{role:'user',content:mod.p}]});
        var mtxt=(mr&&mr.content||[]).map(function(c){return c.text||'';}).join('').trim();
        results.push({id:mod.id,title:mod.t,content:mtxt});
      }catch(me){
        results.push({id:mod.id,title:mod.t,content:'[Module unavailable: '+me.message+']'});
      }
    }

    setPct(96,'Building report\u2026');
    if(prog)prog.style.display='none';
    if(btn){btn.disabled=false;btn.innerHTML='&#128269; Generate Deep Research';}

    // ── BUILD REPORT ───────────────────────────────────────────────────
    var reportDate=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
    var report='<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:940px;color:#1A2E35">';

    // Cover banner
    report+='<div style="background:linear-gradient(135deg,#3B30B0,#5B4ED4);color:#fff;border-radius:14px;padding:24px 28px;margin-bottom:18px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">'
      +'<div><div style="font-size:9px;letter-spacing:2px;opacity:.6;text-transform:uppercase;margin-bottom:5px">DEEP RESEARCH INTELLIGENCE \xb7 '+activeModules.length+' MODULES \xb7 '+depth.toUpperCase()+' \xb7 '+reportDate+'</div>'
      +'<div style="font-size:22px;font-weight:900;line-height:1.2">'+esc(cname)+'</div>'
      +'<div style="font-size:12px;opacity:.75;margin-top:4px">'+esc(sector)+' \xb7 Target: '+esc(exchange)+' \xb7 Private Unlisted</div>'
      +'<div style="font-size:10px;opacity:.5;margin-top:3px">CIN: '+esc(cin)+(website?' \xb7 '+esc(website):'')+'</div></div>'
      +'<div style="text-align:center;min-width:90px">'
      +'<div style="font-size:44px;font-weight:900;color:'+ipoColor+';line-height:1">'+score+'</div>'
      +'<div style="font-size:10px;opacity:.7">/100 IPO Score</div>'
      +'<button onclick="printReport(\'deepresearch\')" style="margin-top:6px;padding:4px 12px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-size:10px;cursor:pointer">&#128438; Print</button>'
      +'</div></div>'
      // Key metrics strip
      +'<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">'
      +[['Revenue','\u20b9'+rev+' Cr'],['PAT','\u20b9'+pat+' Cr'],['EBITDA',ePct+'%'],['ROE',roe+'%'],['D/E',de+'x'],['Score',score+'/100']]
      .map(function(m){return '<div style="background:rgba(255,255,255,.12);border-radius:8px;padding:8px 10px"><div style="font-size:9px;opacity:.6;text-transform:uppercase;margin-bottom:2px">'+m[0]+'</div><div style="font-size:14px;font-weight:800">'+m[1]+'</div></div>';}).join('')
      +'</div></div>';

    // Data sources used
    report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:11px;color:#6B8A94;display:flex;gap:20px;flex-wrap:wrap">'
      +'<span>&#128202; <strong>Probe42/MCA</strong> — live company data</span>'
      +(websiteCtx?'<span>&#127760; <strong>Website</strong> — '+esc(website)+'</span>':'<span style="opacity:.5">&#127760; Website data unavailable</span>')
      +'<span>&#129302; <strong>Claude AI</strong> — '+activeModules.length+' analytical modules</span>'
      +'<span>&#127919; <strong>'+yr24+' Financials</strong> — Revenue \u20b9'+rev+' Cr | CAGR '+rev2yrCagr+'%</span>'
      +'</div>';

    // Module TOC
    report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:16px">'
      +'<div style="font-size:11px;font-weight:700;color:#3B30B0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Research Modules ('+activeModules.length+')</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">';
    results.forEach(function(r){
      report+='<div style="font-size:11px;color:#1A2E35;padding:3px 0;border-bottom:1px solid #F5F5F5">'
        +'<span style="color:#5B4ED4;font-weight:700;margin-right:6px">'+r.id+'</span>'+esc(r.title)+'</div>';
    });
    report+='</div></div>';

    // Each module
    var modColors=['#EFF6FF','#F0FFF4','#FFF5E8','#F5F0FF','#FFF8F0','#F0F8FF','#FFFDF0','#F5FFF5','#F8F0FF','#FFF0F0','#F0FFFF','#FFFFF0','#FFF5FF','#F0F5FF','#FAFFF0'];
    var modBdr=['#1A5C8A','#1A6B3A','#B5370A','#5B4ED4','#E88A2E','#0D5C6B','#8A8A00','#2A6B3A','#7B30B0','#C0392B','#0D7C6B','#8A8000','#8A3AB0','#1A3A8A','#3A8A2A'];

    results.forEach(function(r,i){
      report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;overflow:hidden;margin-bottom:14px">'
        +'<div style="background:'+modBdr[i%modBdr.length]+';padding:10px 16px;display:flex;align-items:center;gap:10px">'
        +'<div style="background:rgba(255,255,255,.25);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">'+r.id+'</div>'
        +'<div style="font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.3px">'+esc(r.title)+'</div>'
        +'</div>'
        +'<div style="padding:16px 18px;background:'+modColors[i%modColors.length]+'" class="ai-body">'+md2html(r.content)+'</div></div>';
    });

    // Directors & Charges
    if(dirs.length){
      report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:12px">'
        +'<div style="font-size:11px;font-weight:700;color:#3B30B0;text-transform:uppercase;margin-bottom:8px">Board of Directors ('+dirs.length+')</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB"><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Name</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Designation</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">DIN</th></tr></thead><tbody>';
      dirs.forEach(function(d,i){report+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'"><td style="padding:7px 10px;font-weight:600">'+esc(d.name||'')+'</td><td style="padding:7px 10px">'+esc(d.designation||'')+'</td><td style="padding:7px 10px;color:#6B8A94;font-size:11px">'+esc(d.din||'')+'</td></tr>';});
      report+='</tbody></table></div>';
    }
    if(chgs.length){
      report+='<div style="background:#fff;border:1px solid #E0EAF0;border-radius:10px;padding:14px;margin-bottom:12px">'
        +'<div style="font-size:11px;font-weight:700;color:#3B30B0;text-transform:uppercase;margin-bottom:8px">Charge Register ('+chgs.length+' total \xb7 '+openChgs+' open)</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F5F8FB"><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0;text-align:left">Holder</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Status</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Amount</th><th style="padding:7px 10px;border-bottom:2px solid #D0E4F0">Date</th></tr></thead><tbody>';
      chgs.forEach(function(c,i){
        var holder=c.charge_holder||c.holder||c.lender_name||c.bank||'See MCA Filings';
        var rawAmt=parseFloat(c.amount)||0;
        // Probe42 returns charge amounts in various units — normalize to Crores
        var amt='Check MCA';
        if(rawAmt>0){
          if(rawAmt>=10000000) amt='\u20b9'+(rawAmt/10000000).toFixed(2)+' Cr'; // absolute rupees
          else if(rawAmt>=100000) amt='\u20b9'+(rawAmt/100000).toFixed(2)+' L';  // lakhs
          else amt='\u20b9'+rawAmt.toFixed(1)+' Cr'; // already in Cr
        }
        report+='<tr style="border-bottom:1px solid #F0F5F8;background:'+(i%2?'#FAFCFD':'#fff')+'"><td style="padding:7px 10px;font-weight:600">'+esc(holder)+'</td><td style="padding:7px 10px"><span style="color:'+(c.status==='Open'?'#C0392B':'#1A6B3A')+';font-weight:600">'+esc(c.status||'')+'</span></td><td style="padding:7px 10px">'+esc(amt)+'</td><td style="padding:7px 10px;color:#6B8A94;font-size:11px">'+esc(c.date_of_creation||'')+'</td></tr>';
      });
      report+='</tbody></table></div>';
    }
    report+='<div style="padding:8px 14px;background:#F8F9FA;border-radius:6px;font-size:10px;color:#9AB0B8">\u26a0\ufe0f ipowork is not SEBI-registered. Not investment advice. Data: Probe42/MCA'+(website?' + '+esc(website):'')+'. \u00a9 2025 ipowork.</div></div>';

    if(out){out.innerHTML=report;out.scrollIntoView({behavior:'smooth',block:'start'});}
    var res={_report:report,company_name:cname,cin:cin,sector:sector,exchange:exchange,revenue_cr:rev,pat_cr:pat,ipo_score:score};
    AIRA_RESULTS['deepresearch']={result:res,cname:cname,sector:sector,tier:'deepresearch'};
    saveReportToStore('deepresearch',cname,sector,res);
    updateFullReportBtn();
  }catch(e){
    if(prog)prog.style.display='none';
    if(btn){btn.disabled=false;btn.innerHTML='&#128269; Generate Deep Research';}
    if(out)out.innerHTML='<div class="err-card"><b>Error:</b> '+esc(e.message)+'</div>';
  }
}
;