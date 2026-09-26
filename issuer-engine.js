/* ipowork Issuer Intelligence engine — v1 (public-data pilot)
 *
 * Turns filed financials (one CSV row per company per financial year, ₹ crore)
 * into one Issuer Intelligence Brief per company. Every number carries a type:
 *   ACTUAL    = from filed accounts
 *   DERIVED   = calculated from actual figures
 *   ESTIMATED = uses an assumption (projection, peer multiple)
 *   EXTERNAL  = market / industry data entered by ipowork
 * Nothing here is a valuation opinion, credit decision or investment advice.
 *
 * Used by issuer-brief-admin.html (to compute and publish) — the portal only renders stored briefs.
 */
(function(){
  var E = window.IPWIssuer = {};
  E.VERSION = 1;

  /* ---------- CSV ---------- */
  E.parseCsv = function(text){
    var lines = String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(function(l){ return l.trim(); });
    if(!lines.length) return [];
    var delim = (lines[0].split('\t').length > lines[0].split(',').length) ? '\t' : ',';
    function split(line){
      var out=[], cur='', q=false;
      for(var i=0;i<line.length;i++){
        var ch=line[i];
        if(q){ if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
        else if(ch==='"') q=true;
        else if(ch===delim){ out.push(cur); cur=''; }
        else cur+=ch;
      }
      out.push(cur); return out.map(function(c){ return c.trim(); });
    }
    var head = split(lines[0]).map(function(h){ return h.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); });
    return lines.slice(1).map(function(l){
      var c = split(l), o = {};
      head.forEach(function(h,i){ o[h] = c[i]===undefined ? '' : c[i]; });
      return o;
    });
  };
  E.TEMPLATE_COLUMNS = ['cin','company_name','sector','city','fy','revenue','ebitda','depreciation','finance_cost','pat','net_worth','total_debt','receivables','inventory','payables','cash_from_ops','capex','net_tangible_assets','operating_profit','public_company','independent_directors','auditor_peer_reviewed','delayed_filings','aira_score','filed_on','active_mandate'];

  function num(v){ if(v===undefined||v===null) return null; var s=String(v).replace(/[₹,\s]/g,''); if(s===''||s==='-'||/^n\/?a$/i.test(s)) return null; var n=Number(s); return isFinite(n)?n:null; }
  function yes(v){ return /^(y|yes|true|1)$/i.test(String(v||'').trim()); }
  function no(v){ return /^(n|no|false|0)$/i.test(String(v||'').trim()); }
  function fyNum(fy){ var m=String(fy||'').match(/(\d{2,4})\s*$/); if(!m) return null; var y=+m[1]; return y<100 ? 2000+y : y; }
  function fyLabel(y){ return 'FY'+String(y).slice(2); }
  function r1(x){ return x===null||!isFinite(x) ? null : Math.round(x*10)/10; }
  function r0(x){ return x===null||!isFinite(x) ? null : Math.round(x); }
  function div(a,b){ return (a===null||b===null||b===0) ? null : a/b; }
  function pct(a,b){ return (a===null||b===null||b===0) ? null : (a-b)/Math.abs(b)*100; }
  function crore(x){ if(x===null) return '—'; var a=Math.abs(x); return (x<0?'−':'')+'₹'+(a>=100?Math.round(a).toLocaleString('en-IN'):a.toFixed(1))+' cr'; }
  E.crore = crore;

  /* ---------- per-year derived metrics ---------- */
  function yearMetrics(y){
    var ebit = (y.ebitda!==null && y.depreciation!==null) ? y.ebitda - y.depreciation : null;
    var capEmployed = (y.net_worth!==null && y.total_debt!==null) ? y.net_worth + y.total_debt : null;
    return {
      ebitda_margin: r1(div(y.ebitda,y.revenue)!==null ? div(y.ebitda,y.revenue)*100 : null),
      pat_margin: r1(div(y.pat,y.revenue)!==null ? div(y.pat,y.revenue)*100 : null),
      roce: r1(div(ebit,capEmployed)!==null ? div(ebit,capEmployed)*100 : null),
      debt_equity: r1(div(y.total_debt,y.net_worth)!==null ? Math.round(div(y.total_debt,y.net_worth)*100)/100 : null),
      debt_ebitda: y.ebitda!==null && y.ebitda>0 && y.total_debt!==null ? Math.round(y.total_debt/y.ebitda*10)/10 : null,
      interest_cover: y.finance_cost ? r1(div(y.ebitda,y.finance_cost)) : null,
      receivable_days: r0(div(y.receivables,y.revenue)!==null ? div(y.receivables,y.revenue)*365 : null),
      inventory_days: r0(div(y.inventory,y.revenue)!==null ? div(y.inventory,y.revenue)*365 : null),
      payable_days: r0(div(y.payables,y.revenue)!==null ? div(y.payables,y.revenue)*365 : null),
      ocf: y.cash_from_ops,
      fcf: (y.cash_from_ops!==null && y.capex!==null) ? r1(y.cash_from_ops - Math.abs(y.capex)) : null,
      ocf_to_pat: (y.cash_from_ops!==null && y.pat) ? Math.round(y.cash_from_ops/y.pat*100) : null,
      ebit: ebit
    };
  }

  var METRICS = [
    {k:'revenue', label:'Revenue', unit:'cr', type:'ACTUAL', good:'up', method:'Revenue from operations, as filed.'},
    {k:'growth', label:'Revenue growth', unit:'%', type:'DERIVED', good:'up', method:'Change in revenue versus the previous financial year.'},
    {k:'ebitda_margin', label:'EBITDA margin', unit:'%', type:'DERIVED', good:'up', method:'EBITDA ÷ revenue.'},
    {k:'pat', label:'Profit after tax', unit:'cr', type:'ACTUAL', good:'up', method:'PAT, as filed.'},
    {k:'pat_margin', label:'PAT margin', unit:'%', type:'DERIVED', good:'up', method:'PAT ÷ revenue.'},
    {k:'roce', label:'ROCE', unit:'%', type:'DERIVED', good:'up', method:'(EBITDA − depreciation) ÷ (net worth + total debt).'},
    {k:'debt_equity', label:'Debt / equity', unit:'x', type:'DERIVED', good:'down', method:'Total debt ÷ net worth.'},
    {k:'debt_ebitda', label:'Debt / EBITDA', unit:'x', type:'DERIVED', good:'down', method:'Total debt ÷ EBITDA.'},
    {k:'interest_cover', label:'Interest cover', unit:'x', type:'DERIVED', good:'up', method:'EBITDA ÷ finance cost.'},
    {k:'receivable_days', label:'Receivable days', unit:'days', type:'DERIVED', good:'down', method:'Trade receivables ÷ revenue × 365.'},
    {k:'inventory_days', label:'Inventory days', unit:'days', type:'DERIVED', good:'down', method:'Inventory ÷ revenue × 365 (revenue basis, as cost of goods is not always filed separately).'},
    {k:'payable_days', label:'Payable days', unit:'days', type:'DERIVED', good:null, method:'Trade payables ÷ revenue × 365 (revenue basis).'},
    {k:'ccc', label:'Cash conversion cycle', unit:'days', type:'DERIVED', good:'down', method:'Receivable days + inventory days − payable days.'},
    {k:'ocf', label:'Operating cash flow', unit:'cr', type:'ACTUAL', good:'up', method:'Net cash from operating activities, as filed.'},
    {k:'fcf', label:'Free cash flow', unit:'cr', type:'DERIVED', good:'up', method:'Operating cash flow − capital expenditure.'}
  ];
  E.METRICS = METRICS;

  /* ---------- eligibility (SEBI ICDR Reg. 6(1), simplified) ---------- */
  function eligibility(years, flags){
    var last3 = years.slice(-3), full = last3.length===3;
    function each(fn){ if(!full) return 'unknown'; return last3.every(fn) ? 'met' : 'not_met'; }
    var opp = last3.map(function(y){ return y.operating_profit!==null ? y.operating_profit : y.m.ebit; });
    var oppProxy = last3.some(function(y){ return y.operating_profit===null; });
    var oppAvg = full && opp.every(function(v){ return v!==null; }) ? opp.reduce(function(a,b){return a+b;},0)/3 : null;
    var nta = each(function(y){ return y.net_tangible_assets!==null && y.net_tangible_assets>=3; });
    if(full && last3.some(function(y){ return y.net_tangible_assets===null; })) nta='unknown';
    var nw = each(function(y){ return y.net_worth!==null && y.net_worth>=1; });
    var opEach = full ? (opp.every(function(v){ return v!==null && v>0; }) ? 'met' : (opp.some(function(v){return v===null;})?'unknown':'not_met')) : 'unknown';
    var opAvg = oppAvg===null ? 'unknown' : (oppAvg>=15 ? 'met' : 'not_met');
    var span = full ? fyLabel(last3[0].year)+'–'+fyLabel(last3[2].year) : 'three full years not available';
    var items = [
      {cat:'Regulatory', label:'Net tangible assets ≥ ₹3 cr in each of the last 3 years', status:nta, detail:span},
      {cat:'Regulatory', label:'Average operating profit ≥ ₹15 cr over the last 3 years', status:opAvg, detail: oppAvg===null?span:('Average '+crore(oppAvg)+' ('+span+')'+(oppProxy?' · EBIT used where operating profit was not filed':''))},
      {cat:'Regulatory', label:'Operating profit in each of the last 3 years', status:opEach, detail:span},
      {cat:'Regulatory', label:'Net worth ≥ ₹1 cr in each of the last 3 years', status:nw, detail:span},
      {cat:'Legal form', label:'Public limited company (only public companies can offer shares to the public)', status: flags.public_company===null?'unknown':(flags.public_company?'met':'not_met'), detail:''},
      {cat:'Investor readiness', label:'Peer-reviewed statutory auditor', status: flags.auditor===null?'unknown':(flags.auditor?'met':'not_met'), detail:''},
      {cat:'Investor readiness', label:'Independent directors on the board', status: flags.indep===null?'unknown':(flags.indep>0?'met':'not_met'), detail: flags.indep===null?'':(flags.indep+' at last filing')},
      {cat:'Investor readiness', label:'No delayed MCA filings in the last 3 years', status: flags.delayed===null?'unknown':(flags.delayed?'not_met':'met'), detail:''}
    ];
    var regulatoryMet = items.slice(0,4).every(function(i){ return i.status==='met'; });
    var projection = null;
    if(full && opAvg==='not_met' && opp.every(function(v){return v!==null && v>0;})){
      var g = Math.pow(opp[2]/opp[0], 1/2) - 1;
      g = Math.max(-0.3, Math.min(0.4, g));
      var next = opp[2]*(1+g), projAvg = (opp[1]+opp[2]+next)/3;
      projection = {type:'ESTIMATED', met: projAvg>=15, nextFy: fyLabel(last3[2].year+1),
        text: projAvg>=15
          ? 'If operating profit keeps its recent growth rate ('+Math.round(g*100)+'% a year), the 3-year average would reach '+crore(projAvg)+' on '+fyLabel(last3[2].year+1)+' accounts — enough to pass this test.'
          : 'At the recent growth rate ('+Math.round(g*100)+'% a year), the 3-year average would be '+crore(projAvg)+' on '+fyLabel(last3[2].year+1)+' accounts — still short of ₹15 cr.',
        method:'Projection only: next year\u2019s operating profit = last year × (1 + two-year compound growth, capped between −30% and +40%). Not a forecast of actual results.'};
    }
    return {items:items, metCount: items.filter(function(i){return i.status==='met';}).length, total: items.length,
      regulatoryMet: regulatoryMet, projection: projection, source:'SEBI ICDR Regulation 6(1) — simplified; legal form and investor-readiness checks added by ipowork.', type:'ACTUAL'};
  }

  /* ---------- stage ---------- */
  var STAGES = {1:'Issuer Watch',2:'Capital Ready',3:'IPO Preparation',4:'IPO Ready',5:'Active Mandate'};
  E.STAGES = STAGES;
  function stage(c, last, prev, elig){
    var aira = c.aira, why = [];
    if(c.activeMandate) return {n:5, name:STAGES[5], why:['An IPO, PE, pre-IPO, debt or advisory engagement is active with ipowork.']};
    var pub = elig.items[4].status==='met';
    if(elig.regulatoryMet && pub && aira!==null && aira>=80) return {n:4, name:STAGES[4], why:['All four SEBI financial tests are met on filed accounts.','Public limited company.','AIRA score '+aira+' (80 or above).']};
    var projected = elig.projection && elig.projection.met;
    if((elig.regulatoryMet || projected) && aira!==null && aira>=65){
      why.push(elig.regulatoryMet ? 'All four SEBI financial tests are met on filed accounts.' : 'The SEBI profit test is projected to be met on next year\u2019s accounts (estimate).');
      why.push('AIRA score '+aira+' (65 or above).');
      if(!pub) why.push('Still a private limited company — conversion needed before an IPO.');
      if(aira<80) why.push('IPO Ready needs AIRA 80 or above.');
      return {n:3, name:STAGES[3], why:why};
    }
    var g = pct(last.revenue, prev?prev.revenue:null);
    if(last.pat!==null && last.pat>=5 && (g===null || g>=0) && (last.m.debt_equity===null || last.m.debt_equity<=2)){
      why.push('PAT '+crore(last.pat)+' (₹5 cr or more).');
      if(g!==null) why.push('Revenue grew '+r1(g)+'% in '+fyLabel(last.year)+'.');
      if(last.m.debt_equity!==null) why.push('Debt/equity '+last.m.debt_equity+' (2.0 or below).');
      why.push('Typically suits PE, pre-IPO, AIF or debt capital before an IPO.');
      if(aira===null) why.push('No AIRA score yet — needed for IPO stages.');
      return {n:2, name:STAGES[2], why:why};
    }
    why.push('Watching for growth, profitability and balance-sheet improvement.');
    if(last.pat!==null && last.pat<5) why.push('PAT below ₹5 cr.');
    if(g!==null && g<0) why.push('Revenue fell in '+fyLabel(last.year)+'.');
    if(last.m.debt_equity!==null && last.m.debt_equity>2) why.push('Debt/equity above 2.0.');
    return {n:1, name:STAGES[1], why:why};
  }

  /* ---------- risk radar (ipowork thresholds, shown to the issuer) ---------- */
  function radar(last, prev, flags){
    var out = [];
    function add(area, level, changed, matters, investigate){ out.push({area:area, level:level, whatChanged:changed, whyItMatters:matters, investigate:investigate}); }
    var m = last.m, p = prev ? prev.m : null, L = fyLabel(last.year);
    // Debt
    var lv='normal';
    if((m.debt_equity!==null&&m.debt_equity>1.5)||(m.debt_ebitda!==null&&m.debt_ebitda>4)) lv='critical';
    else if((m.debt_equity!==null&&m.debt_equity>1.0)||(m.debt_ebitda!==null&&m.debt_ebitda>3)) lv='watch';
    add('Debt', lv, 'Debt/equity '+(m.debt_equity===null?'—':m.debt_equity)+(p&&p.debt_equity!==null?' (was '+p.debt_equity+')':'')+', debt/EBITDA '+(m.debt_ebitda===null?'—':m.debt_ebitda+'×')+' in '+L+'.',
      'Lenders and pre-IPO investors usually look for debt/equity under 1.0 and debt/EBITDA under 3×.', lv==='normal'?'No action needed.':'Which borrowings fund growth versus working capital, and what the repayment plan is.');
    // Interest cover
    lv = m.interest_cover===null?'normal':(m.interest_cover<1.5?'critical':(m.interest_cover<3?'watch':'normal'));
    add('Interest cover', lv, 'EBITDA covers finance cost '+(m.interest_cover===null?'—':m.interest_cover+'×')+' in '+L+'.',
      'Below 3× leaves little room if profits dip or rates rise.', lv==='normal'?'No action needed.':'Cost of each borrowing, and whether refinancing at a lower rate is possible.');
    // Receivables
    var dR = (p&&m.receivable_days!==null&&p.receivable_days!==null) ? m.receivable_days-p.receivable_days : null;
    lv = (m.receivable_days!==null&&m.receivable_days>120)||(dR!==null&&dR>30)?'critical':((m.receivable_days!==null&&m.receivable_days>90)||(dR!==null&&dR>15)?'watch':'normal');
    add('Receivables', lv, 'Customers take '+(m.receivable_days===null?'—':m.receivable_days+' days')+' to pay'+(dR!==null?' ('+(dR>=0?'+':'')+dR+' days vs last year)':'')+'.',
      'Slower collections lock up cash and can hide customer stress.', lv==='normal'?'No action needed.':'Which customers are overdue, and whether credit terms were extended to win sales.');
    // Inventory
    var dI = (p&&m.inventory_days!==null&&p.inventory_days!==null) ? m.inventory_days-p.inventory_days : null;
    lv = dI!==null&&dI>30?'critical':(dI!==null&&dI>15?'watch':'normal');
    add('Inventory', lv, 'Inventory at '+(m.inventory_days===null?'—':m.inventory_days+' days')+' of revenue'+(dI!==null?' ('+(dI>=0?'+':'')+dI+' days vs last year)':'')+'.',
      'Rising inventory ties up cash and can signal slow-moving stock.', lv==='normal'?'No action needed.':'Ageing of stock by product, and whether any is slow-moving or obsolete.');
    // Cash flow
    lv = last.cash_from_ops!==null&&last.cash_from_ops<0?'critical':(m.ocf_to_pat!==null&&m.ocf_to_pat<50?'watch':'normal');
    add('Cash flow', lv, 'Operating cash flow '+crore(last.cash_from_ops)+(m.ocf_to_pat!==null?' — '+m.ocf_to_pat+'% of PAT':'')+' in '+L+'.',
      'Investors check that profits turn into cash; a large gap raises earnings-quality questions.', lv==='normal'?'No action needed.':'Where cash is held up — receivables, inventory or advances — and why.');
    // Profitability
    var dPat = pct(last.pat, prev?prev.pat:null), dMar = (p&&m.ebitda_margin!==null&&p.ebitda_margin!==null)? r1(m.ebitda_margin-p.ebitda_margin):null;
    lv = (dPat!==null&&dPat<-30)||(dMar!==null&&dMar<-3)?'critical':((dPat!==null&&dPat<-15)||(dMar!==null&&dMar<-1.5)?'watch':'normal');
    add('Profitability', lv, 'PAT '+(dPat===null?'—':(dPat>=0?'+':'')+r1(dPat)+'%')+', EBITDA margin '+(m.ebitda_margin===null?'—':m.ebitda_margin+'%')+(dMar!==null?' ('+(dMar>=0?'+':'')+dMar+' pts)':'')+' in '+L+'.',
      'Margin trend is one of the first things investors and lenders test.', lv==='normal'?'No action needed.':'Which costs grew faster than revenue — raw material, staff, or other expenses.');
    // Growth
    var g = pct(last.revenue, prev?prev.revenue:null);
    lv = g!==null&&g<-10?'critical':(g!==null&&g<0?'watch':'normal');
    add('Growth', lv, 'Revenue '+(g===null?'—':(g>=0?'+':'')+r1(g)+'%')+' in '+L+'.',
      'Consistent growth drives valuation and IPO eligibility.', lv==='normal'?'No action needed.':'Whether the fall is volume, price or a lost customer.');
    // Governance
    var gov=[]; if(flags.delayed) gov.push('delayed MCA filings'); if(flags.indep===0) gov.push('no independent directors');
    lv = gov.length ? 'watch' : 'normal';
    add('Governance', lv, gov.length ? 'Filings show '+gov.join(' and ')+'.' : 'No governance items flagged in filings.',
      'Board independence and a clean filing record are checked in every IPO and pre-IPO diligence.', lv==='normal'?'No action needed.':'Board composition plan and filing calendar.');
    return out;
  }

  /* ---------- what changed ---------- */
  var WHY = {
    revenue:['Growth drives valuation and the SEBI profit test.','Whether it came from volume, price or new customers.'],
    ebitda_margin:['Margin moves valuation more than almost any other number.','Which cost lines moved: raw material, staff or overheads.'],
    pat:['PAT sets the base for indicative valuation.','One-off items versus lasting changes.'],
    receivable_days:['Slower collections lock up cash.','Overdue customers and any extended credit terms.'],
    inventory_days:['Rising stock ties up cash.','Slow-moving or obsolete stock.'],
    total_debt:['Higher debt raises interest cost and investor scrutiny.','What the new borrowing funds and how it will be repaid.'],
    cash_from_ops:['Cash generation is how investors test earnings quality.','Where cash is held up in the business.'],
    aira:['Your AIRA score moves your stage and investor-readiness.','The score breakdown in your full AIRA report.'],
    stage:['Stage reflects how close capital or an IPO is.','The reasons listed under your stage.'],
    elig:['Each criterion brings a mainboard IPO closer.','The remaining open criteria.']
  };
  function changes(c, last, prev, prevBrief, stg, elig){
    var list = [];
    var scope='year';
    function push(key, better, weight, title, detail, type, source){ list.push({key:key, scope:scope, dir: better?'up':'down', weight:weight, title:title, detail:detail, whyItMatters:(WHY[key]||[])[0]||'', investigate:(WHY[key]||[])[1]||'', type:type, source:source}); }
    var src = fyLabel(last.year)+' vs '+(prev?fyLabel(prev.year):'')+' filed accounts';
    if(prev){
      var g = pct(last.revenue, prev.revenue);
      if(g!==null) push('revenue', g>=0, Math.abs(g)/10, 'Revenue '+(g>=0?'+':'')+r1(g)+'%', crore(prev.revenue)+' → '+crore(last.revenue), 'ACTUAL', src);
      var dm = (last.m.ebitda_margin!==null&&prev.m.ebitda_margin!==null) ? r1(last.m.ebitda_margin-prev.m.ebitda_margin) : null;
      if(dm!==null) push('ebitda_margin', dm>=0, Math.abs(dm)/1, 'EBITDA margin '+(dm>=0?'+':'')+dm+' pts', prev.m.ebitda_margin+'% → '+last.m.ebitda_margin+'%', 'DERIVED', src);
      var gp = pct(last.pat, prev.pat);
      if(gp!==null) push('pat', gp>=0, Math.abs(gp)/10, 'PAT '+(gp>=0?'+':'')+r1(gp)+'%', crore(prev.pat)+' → '+crore(last.pat), 'ACTUAL', src);
      if(last.m.receivable_days!==null&&prev.m.receivable_days!==null){ var dr=last.m.receivable_days-prev.m.receivable_days; if(dr) push('receivable_days', dr<=0, Math.abs(dr)/5, 'Receivable days '+(dr>0?'+':'')+dr, prev.m.receivable_days+' → '+last.m.receivable_days+' days', 'DERIVED', src); }
      if(last.m.inventory_days!==null&&prev.m.inventory_days!==null){ var di=last.m.inventory_days-prev.m.inventory_days; if(di) push('inventory_days', di<=0, Math.abs(di)/5, 'Inventory days '+(di>0?'+':'')+di, prev.m.inventory_days+' → '+last.m.inventory_days+' days', 'DERIVED', src); }
      if(last.total_debt!==null&&prev.total_debt!==null){ var dd=last.total_debt-prev.total_debt; if(Math.abs(dd)>=0.5) push('total_debt', dd<=0, Math.abs(pct(last.total_debt,prev.total_debt)||0)/10, 'Debt '+(dd>0?'+':'−')+crore(Math.abs(dd)).replace('₹','₹'), crore(prev.total_debt)+' → '+crore(last.total_debt), 'ACTUAL', src); }
      if(last.cash_from_ops!==null&&prev.cash_from_ops!==null){ var dc=last.cash_from_ops-prev.cash_from_ops; if(Math.abs(dc)>=0.5) push('cash_from_ops', dc>=0, Math.abs(dc)/Math.max(1,Math.abs(prev.cash_from_ops))*10, 'Operating cash flow '+(dc>=0?'+':'−')+crore(Math.abs(dc)), crore(prev.cash_from_ops)+' → '+crore(last.cash_from_ops), 'ACTUAL', src); }
    }
    scope='brief';
    if(prevBrief){
      if(c.aira!==null && prevBrief.aira!==null && prevBrief.aira!==undefined && c.aira!==prevBrief.aira){ var da=c.aira-prevBrief.aira; push('aira', da>0, Math.abs(da)*1.5, 'AIRA score '+(da>0?'+':'')+da, prevBrief.aira+' → '+c.aira, 'DERIVED', 'AIRA, since your last brief'); }
      if(prevBrief.stage && prevBrief.stage.n!==stg.n) push('stage', stg.n>prevBrief.stage.n, 20, 'Stage: '+prevBrief.stage.name+' → '+stg.name, 'See why below.', 'DERIVED', 'Since your last brief');
      if(prevBrief.eligibility && prevBrief.eligibility.metCount!==elig.metCount){ var de=elig.metCount-prevBrief.eligibility.metCount; push('elig', de>0, 15, 'Mainboard checks: '+prevBrief.eligibility.metCount+' → '+elig.metCount+' of 8', de>0?'More criteria met.':'A criterion is no longer met.', 'ACTUAL', 'Since your last brief'); }
    }
    /* changes since the last brief always come first; year-on-year filed changes fill the rest,
       and are only repeated from a previous brief if new accounts have been filed since */
    var newAccounts = !prevBrief || prevBrief.latestFy!==fyLabel(last.year);
    var fromBrief = list.filter(function(x){return x.scope==='brief';}).sort(function(a,b){ return b.weight-a.weight; });
    var fromYear = newAccounts ? list.filter(function(x){return x.scope==='year';}).sort(function(a,b){ return b.weight-a.weight; }) : [];
    return fromBrief.concat(fromYear).slice(0,5).map(function(x){ delete x.weight; return x; });
  }

  /* ---------- valuation ---------- */
  function valuation(last, multiples){
    if(!multiples || last.pat===null || last.pat<=0) return null;
    var lo=num(multiples.low), mid=num(multiples.mid), hi=num(multiples.high);
    if(lo===null||mid===null||hi===null) return null;
    return {type:'ESTIMATED', low: Math.round(last.pat*lo), mid: Math.round(last.pat*mid), high: Math.round(last.pat*hi),
      multiples:[lo,mid,hi], pat:last.pat, fy:fyLabel(last.year), asOf: multiples.asOf||'', source: multiples.source||'',
      method: fyLabel(last.year)+' PAT '+crore(last.pat)+' × listed-peer trailing P/E range '+lo+'–'+hi+'× (mid '+mid+'×)'+(multiples.asOf?' as of '+multiples.asOf:'')+'. Analytical estimate only — not a valuation opinion.'};
  }

  /* ---------- build ---------- */
  E.buildBriefs = function(rows, opts){
    opts = opts || {};
    var month = opts.month, sectorMultiples = opts.sectorMultiples||{}, prevBriefs = opts.previous||{};
    var byCin = {}, errors = [];
    rows.forEach(function(r, i){
      var cin = String(r.cin||'').trim().toUpperCase();
      var year = fyNum(r.fy);
      if(!cin){ errors.push('Row '+(i+2)+': missing CIN'); return; }
      if(!year){ errors.push('Row '+(i+2)+' ('+cin+'): FY not recognised — use FY25 or 2025'); return; }
      var y = {year:year};
      ['revenue','ebitda','depreciation','finance_cost','pat','net_worth','total_debt','receivables','inventory','payables','cash_from_ops','capex','net_tangible_assets','operating_profit'].forEach(function(k){ y[k]=num(r[k]); });
      (byCin[cin] = byCin[cin] || {cin:cin, rows:[], meta:{}}).rows.push(y);
      var meta = byCin[cin].meta;
      ['company_name','sector','city','filed_on'].forEach(function(k){ if(r[k]) meta[k]=r[k]; });
      if(r.aira_score!=='' && r.aira_score!==undefined) meta.aira = num(r.aira_score);
      if(r.public_company) meta.public_company = yes(r.public_company)?true:(no(r.public_company)?false:null);
      if(r.auditor_peer_reviewed) meta.auditor = yes(r.auditor_peer_reviewed)?true:(no(r.auditor_peer_reviewed)?false:null);
      if(r.independent_directors!=='' && r.independent_directors!==undefined) meta.indep = num(r.independent_directors);
      if(r.delayed_filings) meta.delayed = yes(r.delayed_filings)?true:(no(r.delayed_filings)?false:null);
      if(r.active_mandate) meta.activeMandate = yes(r.active_mandate);
    });
    var briefs = Object.keys(byCin).map(function(cin){
      var C = byCin[cin], meta = C.meta;
      var years = C.rows.sort(function(a,b){ return a.year-b.year; }).filter(function(y,i,a){ return !i || y.year!==a[i-1].year; });
      years.forEach(function(y){ y.m = yearMetrics(y); });
      years.forEach(function(y,i){ y.m.growth = i ? r1(pct(y.revenue, years[i-1].revenue)) : null;
        y.m.ccc = (y.m.receivable_days!==null&&y.m.inventory_days!==null&&y.m.payable_days!==null) ? y.m.receivable_days+y.m.inventory_days-y.m.payable_days : null; });
      var last = years[years.length-1], prev = years.length>1 ? years[years.length-2] : null;
      var flags = {public_company: meta.public_company===undefined?null:meta.public_company, auditor: meta.auditor===undefined?null:meta.auditor,
                   indep: meta.indep===undefined?null:meta.indep, delayed: meta.delayed===undefined?null:meta.delayed};
      var c = {aira: meta.aira===undefined?null:meta.aira, activeMandate: !!meta.activeMandate};
      var elig = eligibility(years, flags);
      var stg = stage(c, last, prev, elig);
      var prevBrief = prevBriefs[cin] || null;
      var health = METRICS.map(function(M){
        var vals = {}; years.slice(-3).forEach(function(y){ var v = (M.k in y.m) ? y.m[M.k] : y[M.k]; vals[fyLabel(y.year)] = (v===undefined?null:v); });
        return {k:M.k, label:M.label, unit:M.unit, type:M.type, good:M.good, method:M.method, values:vals};
      });
      var filedYear = last.year;
      var brief = {
        v: E.VERSION, cin: cin, name: meta.company_name||cin, sector: meta.sector||'', city: meta.city||'',
        month: month, generatedAt: new Date().toISOString(),
        aira: c.aira, airaPrev: prevBrief ? prevBrief.aira : null,
        latestFy: fyLabel(last.year), years: years.slice(-3).map(function(y){ return fyLabel(y.year); }),
        headline: {revenue:last.revenue, pat:last.pat, ebitda:last.ebitda, netWorth:last.net_worth, debt:last.total_debt},
        stage: stg, stagePrev: prevBrief && prevBrief.stage ? prevBrief.stage : null,
        health: health, eligibility: elig,
        valuation: valuation(last, sectorMultiples[(meta.sector||'').toLowerCase()]),
        valuationPrev: prevBrief && prevBrief.valuation ? prevBrief.valuation : null,
        radar: radar(last, prev, flags),
        changes: changes(c, last, prev, prevBrief, stg, elig),
        schedule: { filedOn: meta.filed_on||'', latestFy: fyLabel(filedYear), nextFy: fyLabel(filedYear+1),
                    nextExpected: 'Oct–Nov '+(filedYear+1) },
        comingSoon: ['IPO twins','Sector IPO window','Competitor watch','Investor demand','Debt cost benchmark','Peer comparison']
      };
      return brief;
    });
    return {briefs: briefs, errors: errors};
  };
})();
