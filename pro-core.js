/* ipowork Pro — shared core for the Merchant Banker, Institution and CA/CS desks.
 *
 * One company record per CIN, built with the same engine as the Issuer Portal
 * (issuer-engine.js) from public-data snapshots already in ipowork:
 * AIRA figures (aira_financials), Risk Desk / portal scans (risk_scan) and published briefs.
 *
 * Firewall rules built in:
 *  - issuers' own valuation runs (aira_valuation) and private uploads are never read here;
 *  - who ran a report, and whether a company uses ipowork, is never shown;
 *  - each user's pipeline / clients / portfolio / watchlists / notes / mandate live in
 *    pro_items, readable only by that user (Supabase row-level security).
 * Everything shown is analytical information, not investment advice.
 */
(function(){
  var P = window.IPWPro = {};
  var SB='https://esqlfsjhekdspycfgnoz.supabase.co', KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcWxmc2poZWtkc3B5Y2Znbm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MzE4ODUsImV4cCI6MjA5MDMwNzg4NX0.nuJCy5xn0K6IpWptphUHv8iXK5xxPm_Eqx-1XzgVHFc';
  var WORKER='https://flat-bread-b021.jiweshkshrivastava.workers.dev/';
  var E = function(){ return window.IPWIssuer; };
  P.CIN_RE=/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

  /* ---------------- helpers ---------------- */
  function hdr(){ return {apikey:KEY, Authorization:'Bearer '+KEY}; }
  async function rest(q){ var r=await fetch(SB+'/rest/v1/reports?'+q,{headers:hdr()}); if(!r.ok) throw new Error('data '+r.status); return r.json(); }
  P.crore=function(x){ if(x===null||x===undefined||!isFinite(x)) return '—'; var a=Math.abs(x); return (x<0?'−':'')+'₹'+(a>=100?Math.round(a).toLocaleString('en-IN'):(+a).toFixed(1))+' cr'; };
  function hv(b,k,y){ var h=(b.health||[]).filter(function(x){return x.k===k;})[0]; if(!h||!h.values) return null; var v=h.values[y||b.latestFy]; return v===undefined?null:v; }
  function prevFy(b){ var ys=b.years||[]; return ys.length>1?ys[ys.length-2]:null; }

  /* ---------------- universe ---------------- */
  P.load = async function(){
    var res=await Promise.all([
      rest('source=eq.aira_financials&order=created_at.desc&limit=3000&select=cin,scores,created_at').catch(function(){return [];}),
      rest('source=eq.risk_scan&order=created_at.desc&limit=3000&select=cin,scores,created_at').catch(function(){return [];}),
      rest('source=eq.issuer_brief&order=created_at.desc&limit=3000&select=cin,scores,created_at').catch(function(){return [];}),
      rest('source=eq.issuer_sector_config&order=created_at.desc&limit=1&select=scores').catch(function(){return [];})
    ]);
    var air={}, risk={}, pub={}, mult=(res[3][0]&&res[3][0].scores&&res[3][0].scores.multiples)||{};
    res[0].forEach(function(r){ if(r.cin&&!air[r.cin]) air[r.cin]=r.scores; });
    res[1].forEach(function(r){ if(r.cin&&!risk[r.cin]) risk[r.cin]=r.scores; });
    res[2].forEach(function(r){ if(r.cin&&!pub[r.cin]) pub[r.cin]=r.scores; });
    var cins={}; [air,risk,pub].forEach(function(o){ Object.keys(o).forEach(function(c){ if(P.CIN_RE.test(c)) cins[c]=1; }); });
    var out={}, month=new Date().toISOString().slice(0,7);
    Object.keys(cins).forEach(function(c){ try{ var C=P.build(c, air[c], risk[c], pub[c], mult, month); if(C) out[c]=C; }catch(e){ console.warn('skip',c,e); } });
    P.U=out; return out;
  };
  P.build = function(cin, a, rs, pb, mult, month){
    var eng=E(); if(!eng) return null;
    var cap = a || (rs && rs.financials && (rs.financials.revenue_fy24||rs.financials.pat_fy24) ? rs : null), b=null;
    if(cap){ b=eng.buildBriefs(eng.rowsFromAira(Object.assign({},cap,{cin:cin})),{month:month,sectorMultiples:mult||{},previous:pb?(function(){var o={};o[cin]=pb;return o;})():{}}).briefs[0]; }
    if(!b && pb) b=pb;
    if(!b) return null;
    var R = rs ? eng.riskFromScan(rs) : null;
    var dp = eng.debtProfile ? eng.debtProfile(cap||{financials:{}}, rs||null, b) : null;
    var ep = eng.equityProfile ? eng.equityProfile(cap||{financials:{}}, b) : null;
    var fy=b.latestFy, pf=prevFy(b), h=b.headline||{};
    var m={ revenue:h.revenue, pat:h.pat, ebitda:h.ebitda, debt:h.debt, netWorth:h.netWorth,
      growth:hv(b,'growth'), patPrev:pf?hv(b,'pat',pf):null, ebitdaM:hv(b,'ebitda_margin'), patM:hv(b,'pat_margin'), roce:hv(b,'roce'),
      de:hv(b,'debt_equity'), debtEbitda:hv(b,'debt_ebitda'), icr:hv(b,'interest_cover'), recvDays:hv(b,'receivable_days'), ccc:hv(b,'ccc'), ocf:hv(b,'ocf'),
      aira:b.aira, stage:b.stage?b.stage.n:null, stageName:b.stage?b.stage.name:'', risk:R?R.overall:null, riskBand:R?R.band:'',
      capacity:dp&&dp.metrics?dp.metrics.capacity:null, shortShare:dp&&dp.metrics?dp.metrics.shortShare:null,
      promoter:ep&&ep.metrics?ep.metrics.promoterPct:null, elig:b.eligibility?b.eligibility.metCount:null };
    m.patGrowth = (m.pat!=null&&m.patPrev) ? Math.round((m.pat-m.patPrev)/Math.abs(m.patPrev)*1000)/10 : null;
    var C={ cin:cin, name:b.name||cin, sector:b.sector||eng.nicSector(cin)||'', state:b.city||(cap&&cap.registered_state)||'', fy:fy, brief:b, risk:R, debt:dp, equity:ep, m:m,
      asOf:(cap&&cap.capturedAt)||(rs&&rs.capturedAt)||(pb&&pb.generatedAt)||'' };
    C.flags=P.flags(C); C.routes=P.routes(C); C.cls=P.classify(C);
    return C;
  };

  /* ---------------- flags: what changed → why it matters → what to investigate ---------------- */
  P.flags = function(C){
    var out=[];
    (C.brief.radar||[]).forEach(function(r){ if(r.level==='critical'||r.level==='watch') out.push({lvl:r.level, area:r.area, what:r.whatChanged, why:r.whyItMatters, check:r.investigate, src:'Filed accounts'}); });
    if(C.risk) C.risk.items.forEach(function(i){ if(i.level==='critical'||i.level==='watch') out.push({lvl:i.level, area:i.area, what:i.finding, why:i.why, check:i.advice, src:'MCA / Risk Desk data'}); });
    var seen={}; out=out.filter(function(f){ var k=f.area+'|'+f.lvl; if(seen[k]) return false; seen[k]=1; return true; });
    out.sort(function(a,b){ return (a.lvl==='critical'?0:1)-(b.lvl==='critical'?0:1); });
    return out;
  };

  /* ---------------- capital routes (intelligence, not advice) ---------------- */
  P.routes = function(C){
    var m=C.m, b=C.brief, el=b.eligibility||{}, R=[], cr=P.crore;
    function add(route, fit, reason, next){ R.push({route:route, fit:fit, reason:reason, next:next}); }
    if(el.regulatoryMet) add('Mainboard IPO','strong','All four SEBI financial tests met on '+C.fy+' accounts'+(m.aira!=null?'; AIRA '+m.aira:'')+'.','Discuss IPO readiness, board and DRHP timeline');
    else if(el.projection&&el.projection.met) add('Mainboard IPO','possible','SEBI profit test projected to clear on next year\u2019s accounts (estimate).','Plan the gap to eligibility');
    if(!el.regulatoryMet && m.pat!=null && m.pat>=1 && m.netWorth!=null && m.netWorth>=1 && m.revenue!=null && m.revenue<=250 && (m.aira==null||m.aira>=60) && (m.growth==null||m.growth>=0))
      add('SME IPO','possible','Profitable (PAT '+cr(m.pat)+') with net worth '+cr(m.netWorth)+'; SME platform may be reachable sooner — verify exchange criteria.','Check SME exchange eligibility');
    if((m.stage>=3) || (el.projection&&el.projection.met&&m.growth>=15)) add('Pre-IPO round','possible','Stage '+m.stageName+(m.growth!=null?', revenue growth '+m.growth+'%':'')+'.','Explore a pre-IPO placement');
    if(m.pat!=null && m.pat>=5 && m.growth!=null && m.growth>=15) add('PE / AIF growth equity', (m.roce!=null&&m.roce>=15)?'strong':'possible', 'PAT '+cr(m.pat)+', growth '+m.growth+'%'+(m.roce!=null?', ROCE '+m.roce+'%':'')+'.','Explore growth equity');
    if(m.icr!=null && m.icr>=3 && m.capacity!=null && m.capacity>2) add('Term debt', m.capacity>10?'strong':'possible','Interest cover '+m.icr+'\u00d7, indicative headroom '+cr(m.capacity)+'.','Evaluate term-loan capacity');
    if((m.recvDays!=null&&m.recvDays>90)||(m.ccc!=null&&m.ccc>100)) add('Working-capital finance','possible','Cash conversion cycle '+(m.ccc!=null?m.ccc+' days':'long')+(m.recvDays!=null?', receivables '+m.recvDays+' days':'')+'.','Review working-capital lines / receivable finance');
    if(m.debt!=null && m.debt>=25 && ((m.icr!=null&&m.icr>=1.5&&m.icr<3)||(m.de!=null&&m.de>1.5))) add('NCD / private credit','possible','Debt '+cr(m.debt)+(m.de!=null?', debt/equity '+m.de+'\u00d7':'')+(m.icr!=null?', interest cover '+m.icr+'\u00d7':'')+'.','Explore structured or private credit');
    if((m.ebitda!=null&&m.ebitda<=0)||(m.icr!=null&&m.icr<1.5)) add('Restructuring review','attention','EBITDA '+cr(m.ebitda)+(m.icr!=null?', interest cover '+m.icr+'\u00d7':'')+'.','Review the financial position');
    return R;
  };

  /* ---------------- radar categories ---------------- */
  P.classify = function(C){
    var m=C.m, f=C.flags, crit=f.filter(function(x){return x.lvl==='critical';}).length, watch=f.length-crit, r=C.routes.map(function(x){return x.route;});
    var fin=f.filter(function(x){ return /Debt|Interest|Receivables|Inventory|Cash|Profitab|Growth|Leverage/i.test(x.area); }).length;
    var comp=f.filter(function(x){ return /Governance|EPFO|GST|ROC|Board|MSME|Related|Legal|Charges/i.test(x.area); }).length;
    return {
      attention: crit>0,
      healthy: crit===0 && watch<=1,
      growth: m.growth!=null && m.growth>=20 && (m.patGrowth==null||m.patGrowth>=0),
      finWatch: fin>0, compWatch: comp>0,
      capitalReq: r.some(function(x){ return /debt|Working|NCD|PE|Pre-IPO/.test(x); }),
      ipo: r.indexOf('Mainboard IPO')>-1 || m.stage>=3 || (r.indexOf('SME IPO')>-1 && (m.aira||0)>=70),
      sme: r.indexOf('SME IPO')>-1, mainboard: r.indexOf('Mainboard IPO')>-1,
      pe: r.indexOf('PE / AIF growth equity')>-1 || r.indexOf('Pre-IPO round')>-1,
      debt: r.some(function(x){ return /Term debt|Working|NCD/.test(x); }),
      highPotential: (m.stage>=3 && (m.aira||0)>=70) || (m.stage>=2 && (m.aira||0)>=80 && (m.growth||0)>=15)
    };
  };

  /* ---------------- change detection against a saved snapshot ---------------- */
  P.snap = function(C){ var m=C.m; return {fy:C.fy, aira:m.aira, stage:m.stage, revenue:m.revenue, pat:m.pat, debt:m.debt, risk:m.risk, flags:C.flags.length, at:new Date().toISOString()}; };
  P.diff = function(old, C){
    if(!old) return []; var m=C.m, out=[], cr=P.crore;
    if(old.fy && old.fy!==C.fy) out.push({t:'New accounts filed: '+C.fy, good:null});
    if(old.stage!=null && m.stage!=null && old.stage!==m.stage) out.push({t:'Stage '+old.stage+' \u2192 '+m.stage+' ('+m.stageName+')', good:m.stage>old.stage});
    if(old.aira!=null && m.aira!=null && old.aira!==m.aira) out.push({t:'AIRA '+old.aira+' \u2192 '+m.aira, good:m.aira>old.aira});
    if(old.risk!=null && m.risk!=null && Math.abs(old.risk-m.risk)>=3) out.push({t:'Risk Desk '+old.risk+' \u2192 '+m.risk, good:m.risk>old.risk});
    if(old.revenue && m.revenue && Math.abs(m.revenue-old.revenue)/old.revenue>0.05) out.push({t:'Revenue '+cr(old.revenue)+' \u2192 '+cr(m.revenue), good:m.revenue>old.revenue});
    if(old.debt!=null && m.debt!=null && Math.abs(m.debt-old.debt)>=1) out.push({t:'Debt '+cr(old.debt)+' \u2192 '+cr(m.debt), good:m.debt<old.debt});
    if(old.flags!=null && C.flags.length>old.flags) out.push({t:(C.flags.length-old.flags)+' new flag(s)', good:false});
    return out;
  };

  /* ---------------- explainable matching (institution mandate vs company) ---------------- */
  P.match = function(C, M){
    if(!M) return null; var m=C.m, checks=[];
    function chk(label, applies, pass, detail){ if(applies) checks.push({label:label, pass:!!pass, detail:detail}); }
    var sectors=(M.sectors||[]).map(function(s){return s.toLowerCase();}), states=(M.states||[]).map(function(s){return s.toLowerCase();});
    chk('Sector', sectors.length, sectors.indexOf(String(C.sector).toLowerCase())>-1, C.sector||'unknown');
    chk('Geography', states.length, states.indexOf(String(C.state).toLowerCase())>-1, C.state||'unknown');
    chk('Revenue', M.minRev||M.maxRev, m.revenue!=null && (!M.minRev||m.revenue>=M.minRev) && (!M.maxRev||m.revenue<=M.maxRev), P.crore(m.revenue));
    chk('PAT', M.minPat, m.pat!=null && m.pat>=M.minPat, P.crore(m.pat));
    chk('Growth', M.minGrowth, m.growth!=null && m.growth>=M.minGrowth, m.growth!=null?m.growth+'%':'—');
    chk('ROCE', M.minRoce, m.roce!=null && m.roce>=M.minRoce, m.roce!=null?m.roce+'%':'—');
    chk('Leverage', M.maxDe, m.de!=null && m.de<=M.maxDe, m.de!=null?'debt/equity '+m.de+'\u00d7':'—');
    chk('Stage', (M.stages||[]).length, (M.stages||[]).indexOf(m.stage)>-1, m.stageName||'—');
    var want=M.routes||[], have=C.routes.map(function(r){return r.route;});
    chk('Capital route', want.length, want.some(function(w){ return have.some(function(h){ return h.toLowerCase().indexOf(w.toLowerCase())>-1; }); }), have.join(', ')||'none identified');
    var pass=checks.filter(function(c){return c.pass;}).length;
    return {score: checks.length?Math.round(pass/checks.length*100):null, pass:pass, total:checks.length, checks:checks};
  };
  P.MATCH_METHOD='Match % = criteria met ÷ criteria you set in your mandate. Each criterion is shown with the company\u2019s actual figure; no hidden weights.';

  /* ---------------- private workspace (pro_items, row-level security) ---------------- */
  var W=P.ws={mode:'device', items:[], uid:'local'};
  W.init = async function(profile){
    W.uid=(profile&&profile.id)||'local'; W.items=[];
    try{
      var c=window.IPWGate&&IPWGate.getClient?await IPWGate.getClient():null;
      if(c && IPWGate.session){ var r=await c.from('pro_items').select('kind,key,data,updated_at'); if(!r.error){ W.mode='secure'; W.c=c; W.items=r.data||[]; return W.mode; } }
    }catch(e){}
    W.mode='device'; try{ W.items=JSON.parse(localStorage.getItem('ipw_pro_items_'+W.uid)||'[]'); }catch(e){ W.items=[]; }
    return W.mode;
  };
  function saveLocal(){ try{ localStorage.setItem('ipw_pro_items_'+W.uid, JSON.stringify(W.items)); }catch(e){} }
  W.get=function(kind,key){ return W.items.filter(function(i){return i.kind===kind&&i.key===key;})[0]||null; };
  W.all=function(kind){ return W.items.filter(function(i){return i.kind===kind;}); };
  W.put=async function(kind,key,data){
    var it=W.get(kind,key); if(it){ it.data=data; it.updated_at=new Date().toISOString(); } else W.items.push({kind:kind,key:key,data:data,updated_at:new Date().toISOString()});
    if(W.mode==='secure'){ var r=await W.c.from('pro_items').upsert({kind:kind,key:key,data:data,updated_at:new Date().toISOString()},{onConflict:'user_id,kind,key'}); if(r.error) throw new Error(r.error.message); } else saveLocal();
  };
  W.del=async function(kind,key){
    W.items=W.items.filter(function(i){ return !(i.kind===kind&&i.key===key); });
    if(W.mode==='secure'){ var r=await W.c.from('pro_items').delete().eq('kind',kind).eq('key',key); if(r.error) throw new Error(r.error.message); } else saveLocal();
  };

  /* ---------------- add a company by CIN (signed-in users; costs one data call) ---------------- */
  P.addCin = async function(cin, byEmail){
    cin=String(cin||'').trim().toUpperCase(); if(!P.CIN_RE.test(cin)) throw new Error('Enter a valid 21-character CIN');
    var recent=await rest('source=eq.risk_scan&cin=eq.'+cin+'&order=created_at.desc&limit=1&select=scores').catch(function(){return [];});
    if(recent[0] && Date.now()-new Date(recent[0].scores.capturedAt).getTime()<7*86400000) return 'cached';
    var c=new AbortController(), t=setTimeout(function(){c.abort();},60000), r;
    try{ r=await fetch(WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'probe42_raw',cin:cin}),signal:c.signal}); } finally{ clearTimeout(t); }
    if(r.status===401) throw new Error('Please sign in again');
    var d=r.ok?await r.json():null; if(!d||d.error) throw new Error((d&&d.error)||('data service '+r.status));
    var snap={cin:cin, company_name:d.company_name||'', financials:d.financials||{}, legal:d.legal||{}, compliance:d.compliance||{}, cirp_status:d.cirp_status||null,
      directors:(d.directors||[]).map(function(x){return {name:x.name||'',designation:x.designation||'',cessation:x.cessation||null};}),
      charges:(d.charges||[]).map(function(x){return {charge_holder:x.charge_holder||'',amount:x.amount||null,status:x.status||'',date_of_creation:x.date_of_creation||''};}),
      related_party_transactions:(d.related_party_transactions||[]).map(function(x){return {relation:x.relation||'',nature:x.nature||''};}),
      credit_ratings:(d.credit_ratings||[]).slice(0,6), company_type:d.company_type||null, registered_state:d.registered_state||null,
      profiles:d.profiles||null, paid_up_capital:d.paid_up_capital||null, authorised_capital:d.authorised_capital||null,
      source:'pro_desk', capturedBy:String(byEmail||'').toLowerCase(), capturedAt:new Date().toISOString()};
    var ins=await fetch(SB+'/rest/v1/reports',{method:'POST',headers:Object.assign({'Content-Type':'application/json','Prefer':'return=minimal'},hdr()),
      body:JSON.stringify({report_id:'RISKSCAN-'+cin+'-'+Date.now(),company_name:(snap.company_name||'N/A').slice(0,200),cin:cin,sector:'N/A',exchange:'N/A',tier:'free',score:0,source:'risk_scan',scores:snap})});
    if(!ins.ok) throw new Error('could not save ('+ins.status+')');
    return 'fetched';
  };

  /* ---------------- Ask IPOWORK: answers only from the data shown ---------------- */
  P.ask = async function(question, companies, deskLabel){
    var rows=companies.slice(0,150).map(function(C){ var m=C.m; return {cin:C.cin, name:C.name, sector:C.sector, state:C.state, fy:C.fy, revenue_cr:m.revenue, growth_pct:m.growth, pat_cr:m.pat, pat_growth_pct:m.patGrowth,
      ebitda_margin_pct:m.ebitdaM, roce_pct:m.roce, debt_cr:m.debt, debt_equity:m.de, debt_ebitda:m.debtEbitda, interest_cover:m.icr, receivable_days:m.recvDays, operating_cash_flow_cr:m.ocf,
      aira:m.aira, stage:m.stageName, risk_desk:m.risk, debt_headroom_cr:m.capacity, routes:C.routes.map(function(r){return r.route;}), flags:C.flags.slice(0,5).map(function(f){return f.area+': '+f.what;})}; });
    var sys='You are IPOWORK\u2019s analyst for a '+deskLabel+'. Answer ONLY from the JSON company data provided. For every company you mention, give its name and CIN and the exact figures you relied on. '
      +'If the data cannot answer the question, say so plainly and say what data is missing. Never invent companies, figures or events. This is analytical information, not investment, legal or credit advice; do not recommend buying, selling or lending. Be concise; use short lists.';
    var r=await fetch(WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'claudeProxy',model:'claude-haiku-4-5-20251001',max_tokens:1400,system:sys,
      messages:[{role:'user',content:'Company data ('+rows.length+' companies):\n'+JSON.stringify(rows)+'\n\nQuestion: '+question}]})});
    if(r.status===401) throw new Error('Please sign in again');
    var d=await r.json(); var txt=(d.content||[]).map(function(c){return c.text||'';}).join('').trim();
    if(!txt) throw new Error((d&&d.error)||'no answer');
    return txt;
  };
})();
