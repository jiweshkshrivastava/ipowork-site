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
  var OVERRIDABLE = ['roce','receivable_days','inventory_days','interest_cover','debt_equity','ebitda_margin'];
  function applyOverrides(y){ if(!y.ov) return; OVERRIDABLE.forEach(function(k){ if((y.m[k]===null||y.m[k]===undefined) && y.ov[k]!==null && y.ov[k]!==undefined){ y.m[k]=y.ov[k]; (y.m._from=y.m._from||{})[k]='MCA ratio data'; } }); }

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
    var ntaVals = last3.map(function(y){ return y.net_tangible_assets!==null ? y.net_tangible_assets : (flags.ntaBasis==='net_worth' ? y.net_worth : null); });
    var nta = full ? (ntaVals.some(function(v){return v===null;}) ? 'unknown' : (ntaVals.every(function(v){return v>=3;})?'met':'not_met')) : 'unknown';
    var nw = each(function(y){ return y.net_worth!==null && y.net_worth>=1; });
    var opEach = full ? (opp.every(function(v){ return v!==null && v>0; }) ? 'met' : (opp.some(function(v){return v===null;})?'unknown':'not_met')) : 'unknown';
    var opAvg = oppAvg===null ? 'unknown' : (oppAvg>=15 ? 'met' : 'not_met');
    var span = full ? fyLabel(last3[0].year)+'–'+fyLabel(last3[2].year) : 'three full years not available';
    var items = [
      {cat:'Regulatory', label:'Net tangible assets ≥ ₹3 cr in each of the last 3 years', status:nta, detail:span+(flags.ntaBasis==='net_worth'?' · net worth used as a stand-in (intangibles not filed separately)':''), type:(flags.ntaBasis==='net_worth'?'ESTIMATED':'ACTUAL')},
      {cat:'Regulatory', label:'Average operating profit ≥ ₹15 cr over the last 3 years', status:opAvg, detail: oppAvg===null?span:('Average '+crore(oppAvg)+' ('+span+')'+(flags.opBasis==='pbt'?' · profit before tax used as a conservative stand-in for operating profit':(oppProxy?' · EBIT used where operating profit was not filed':''))), type:(flags.opBasis==='pbt'||oppProxy?'ESTIMATED':'ACTUAL')},
      {cat:'Regulatory', label:'Operating profit in each of the last 3 years', status:opEach, detail:span},
      {cat:'Regulatory', label:'Net worth ≥ ₹1 cr in each of the last 3 years', status:nw, detail:span},
      {cat:'Legal form', label:'Public limited company (only public companies can offer shares to the public)', status: flags.public_company===null?'unknown':(flags.public_company?'met':'not_met'), detail:''},
      {cat:'Investor readiness', label:'Peer-reviewed statutory auditor', status: flags.auditor===null?'unknown':(flags.auditor?'met':'not_met'), detail: flags.auditorName?('Auditor on record: '+flags.auditorName+(flags.auditor===null?' \u2014 confirm peer-review status (ICAI Peer Review Board)':'')):'', confirm: flags.auditor===null && !!flags.auditorName},
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
    function add(area, level, changed, matters, investigate, missing){ if(missing){ out.push({area:area, level:'na', whatChanged:'Not available in the filed data we hold.', whyItMatters:matters, investigate:''}); return; } out.push({area:area, level:level, whatChanged:changed, whyItMatters:matters, investigate:investigate}); }
    var m = last.m, p = prev ? prev.m : null, L = fyLabel(last.year);
    // Debt
    var lv='normal';
    if((m.debt_equity!==null&&m.debt_equity>1.5)||(m.debt_ebitda!==null&&m.debt_ebitda>4)) lv='critical';
    else if((m.debt_equity!==null&&m.debt_equity>1.0)||(m.debt_ebitda!==null&&m.debt_ebitda>3)) lv='watch';
    add('Debt', lv, 'Debt/equity '+(m.debt_equity===null?'—':m.debt_equity)+(p&&p.debt_equity!==null?' (was '+p.debt_equity+')':'')+', debt/EBITDA '+(m.debt_ebitda===null?'—':m.debt_ebitda+'×')+' in '+L+'.',
      'Lenders and pre-IPO investors usually look for debt/equity under 1.0 and debt/EBITDA under 3×.', lv==='normal'?'No action needed.':'Which borrowings fund growth versus working capital, and what the repayment plan is.', m.debt_equity===null&&m.debt_ebitda===null);
    // Interest cover
    lv = m.interest_cover===null?'normal':(m.interest_cover<1.5?'critical':(m.interest_cover<3?'watch':'normal'));
    add('Interest cover', lv, 'EBITDA covers finance cost '+(m.interest_cover===null?'—':m.interest_cover+'×')+' in '+L+'.',
      'Below 3× leaves little room if profits dip or rates rise.', lv==='normal'?'No action needed.':'Cost of each borrowing, and whether refinancing at a lower rate is possible.', m.interest_cover===null);
    // Receivables
    var dR = (p&&m.receivable_days!==null&&p.receivable_days!==null) ? m.receivable_days-p.receivable_days : null;
    lv = (m.receivable_days!==null&&m.receivable_days>120)||(dR!==null&&dR>30)?'critical':((m.receivable_days!==null&&m.receivable_days>90)||(dR!==null&&dR>15)?'watch':'normal');
    add('Receivables', lv, 'Customers take '+(m.receivable_days===null?'—':m.receivable_days+' days')+' to pay'+(dR!==null?' ('+(dR>=0?'+':'')+dR+' days vs last year)':'')+'.',
      'Slower collections lock up cash and can hide customer stress.', lv==='normal'?'No action needed.':'Which customers are overdue, and whether credit terms were extended to win sales.', m.receivable_days===null);
    // Inventory
    var dI = (p&&m.inventory_days!==null&&p.inventory_days!==null) ? m.inventory_days-p.inventory_days : null;
    lv = dI!==null&&dI>30?'critical':(dI!==null&&dI>15?'watch':'normal');
    add('Inventory', lv, 'Inventory at '+(m.inventory_days===null?'—':m.inventory_days+' days')+' of revenue'+(dI!==null?' ('+(dI>=0?'+':'')+dI+' days vs last year)':'')+'.',
      'Rising inventory ties up cash and can signal slow-moving stock.', lv==='normal'?'No action needed.':'Ageing of stock by product, and whether any is slow-moving or obsolete.', m.inventory_days===null);
    // Cash flow
    lv = last.cash_from_ops!==null&&last.cash_from_ops<0?'critical':(m.ocf_to_pat!==null&&m.ocf_to_pat<50?'watch':'normal');
    add('Cash flow', lv, (last.cash_from_ops!==null&&last.cash_from_ops<0&&last.pat!==null) ? 'Operating cash flow '+crore(last.cash_from_ops)+' against PAT of '+crore(last.pat)+' in '+L+' \u2014 profits aren\u2019t turning into cash.'
      : (m.ocf_to_pat!==null&&m.ocf_to_pat<50&&last.pat!==null) ? 'Operating cash flow '+crore(last.cash_from_ops)+' is only '+m.ocf_to_pat+'% of PAT ('+crore(last.pat)+') in '+L+'.'
      : 'Operating cash flow '+crore(last.cash_from_ops)+(m.ocf_to_pat!==null?' \u2014 '+m.ocf_to_pat+'% of PAT':'')+' in '+L+'.',
      'Investors check that profits turn into cash; a large gap raises earnings-quality questions.', lv==='normal'?'No action needed.':'Where cash is held up — receivables, inventory or advances — and why.', last.cash_from_ops===null);
    // Profitability
    var dPat = pct(last.pat, prev?prev.pat:null), dMar = (p&&m.ebitda_margin!==null&&p.ebitda_margin!==null)? r1(m.ebitda_margin-p.ebitda_margin):null;
    lv = (dPat!==null&&dPat<-30)||(dMar!==null&&dMar<-3)?'critical':((dPat!==null&&dPat<-15)||(dMar!==null&&dMar<-1.5)?'watch':'normal');
    add('Profitability', lv, 'PAT '+(dPat===null?'—':(dPat>=0?'+':'')+r1(dPat)+'%')+', EBITDA margin '+(m.ebitda_margin===null?'—':m.ebitda_margin+'%')+(dMar!==null?' ('+(dMar>=0?'+':'')+dMar+' pts)':'')+' in '+L+'.',
      'Margin trend is one of the first things investors and lenders test.', lv==='normal'?'No action needed.':'Which costs grew faster than revenue — raw material, staff, or other expenses.', dPat===null&&m.ebitda_margin===null);
    // Growth
    var g = pct(last.revenue, prev?prev.revenue:null);
    lv = g!==null&&g<-10?'critical':(g!==null&&g<0?'watch':'normal');
    add('Growth', lv, 'Revenue '+(g===null?'—':(g>=0?'+':'')+r1(g)+'%')+' in '+L+'.',
      'Consistent growth drives valuation and IPO eligibility.', lv==='normal'?'No action needed.':'Whether the fall is volume, price or a lost customer.', g===null);
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

  var OVERRIDABLE_IN = ['roce','receivable_days','inventory_days','interest_cover','debt_equity','ebitda_margin'];
  /* ---------- AIRA report → engine rows ----------
     Uses the Probe42/MCA figures AIRA already fetched. Where MCA data doesn't carry
     a field, it stays blank (shown as "not available"), never guessed.
     Stand-ins, each labelled on the page: profit before tax for operating profit,
     net worth for net tangible assets; latest-year ratios from MCA ratio data. */
  E.rowsFromAira = function(a){
    var f = a.financials || {}, cin = String(a.cin||'').toUpperCase();
    function lab(x, d){ var m=String(x||'').match(/(\d{2})\s*$/); return m ? 'FY'+m[1] : d; }
    var y24 = lab(f.fy24_year || f.fy_year, null), n = y24 ? +y24.slice(2) : null;
    var y23 = lab(f.fy23_year, n ? 'FY'+(n-1) : 'FY23'), y22 = lab(f.fy22_year, n ? 'FY'+(n-2) : 'FY22');
    if(!y24) y24 = 'FY'+(+y23.slice(2)+1);
    var pub = /PLC/.test(cin) ? 'Y' : (/PTC/.test(cin) ? 'N' : (/public/i.test(a.company_type||'') ? 'Y' : (/private/i.test(a.company_type||'') ? 'N' : '')));
    var common = { cin:cin, company_name:a.company_name||'', sector:a.sector||'', city:a.registered_state||'', public_company:pub,
      independent_directors: (a.independent_directors===null||a.independent_directors===undefined) ? '' : a.independent_directors,
      aira_score: a.aira_score===null||a.aira_score===undefined ? '' : a.aira_score, filed_on: a.last_filing_date||'', op_basis:'pbt', nta_basis:'net_worth',
      auditor_name: (f.auditor && typeof f.auditor==='object') ? (f.auditor.name||f.auditor.auditor_name||'') : (f.auditor||'') };
    function row(o){ return Object.assign({}, common, o); }
    if(!common.sector || /^(other|others|n\/a|na|general|manufacturing|services|trading)$/i.test(common.sector)) common.sector = E.nicSector(cin) || common.sector;
    var D = E.detailFrom(a);
    if(D && D.length >= 2){
      common.op_basis=''; common.nta_basis='';
      var byFy = {}; D.forEach(function(d){ byFy[d.fy]=d; });
      return D.slice(0,3).reverse().map(function(d, i, arr){
        var last = i===arr.length-1;
        var r = row({ fy:d.fy, revenue:d.revenue, ebitda:d.ebitda, depreciation:d.dep, finance_cost:d.fc, pat:d.pat, net_worth:d.equity, total_debt:d.debt,
          receivables:d.receivables, inventory:d.inventory, payables:d.payables, cash_from_ops:d.cfo, capex:d.capex, net_tangible_assets:d.nta, operating_profit:d.opProfit });
        if(last){ r.ov_roce=f.roce; r.ov_interest_cover=f.interest_coverage; }
        return r;
      }).filter(function(r){ return r.revenue!=null || r.pat!=null || r.net_worth!=null; });
    }
    return [
      row({ fy:y22, revenue:f.revenue_fy22, pat:f.pat_fy22, ebitda:f.ebitda_fy22, net_worth:f.net_worth_fy22, operating_profit:f.pbt_fy22 }),
      row({ fy:y23, revenue:f.revenue_fy23, pat:f.pat_fy23, ebitda:f.ebitda_fy23, net_worth:f.net_worth_fy23, operating_profit:f.pbt_fy23 }),
      row({ fy:y24, revenue:f.revenue_fy24, pat:f.pat_fy24, ebitda:(f.ebitda_cr!=null?f.ebitda_cr:f.operating_profit), net_worth:f.net_worth, total_debt:f.total_debt,
            receivables:f.trade_receivables, inventory:f.inventories_cr, cash_from_ops:f.operating_cashflow, capex:f.capex, operating_profit:f.profit_before_tax,
            ov_roce:f.roce, ov_receivable_days:f.debtor_days, ov_inventory_days:f.inventory_days, ov_interest_cover:f.interest_coverage,
            ov_debt_equity:f.debt_equity_ratio, ov_ebitda_margin:f.ebitda_margin })
    ].filter(function(r){ return r.revenue!=null || r.pat!=null || r.net_worth!=null; });
  };

  /* ---------- Risk profile (same scoring as ipowork Risk Desk) ----------
     Input: the MCA/Probe42 snapshot a Risk Desk scan returns. Output: the five
     Risk Desk scores plus findings and advice in plain language. Findings are
     items for management attention, never allegations. */
  E.riskFromScan = function(d){
    d = d || {};
    var fin=d.financials||{}, leg=d.legal||{}, comp=d.compliance||{};
    var dirs=(d.directors||[]).filter(function(x){ return x && !x.cessation; });
    var open=(d.charges||[]).filter(function(c){ return String(c.status||'').toLowerCase().indexOf('open')>-1; }); /* exactly as Risk Desk counts them */
    var against=parseInt(leg.cases_against_count||0,10)||0, pending=parseInt(leg.pending_count||0,10)||0;
    // — identical formulas to risk-desk.html populateRiskResults —
    var legal=80; if(comp.defaulter) legal-=40; if(against>30) legal-=20; else if(against>15) legal-=12; else if(against>5) legal-=6; if(pending>10) legal-=10; else if(pending>3) legal-=5; legal=Math.max(20,Math.min(95,legal));
    var forensic=Math.max(30, 90-open.length*5-(comp.msme_delays||0)*3);
    var gov=Math.min(90, 40+(dirs.length>=5?25:dirs.length>=3?15:8)+(open.length===0?20:open.length<=2?10:0));
    var roe=parseFloat(fin.roe||0), de=parseFloat(fin.debt_equity_ratio||0), finS=50;
    if(roe>=20) finS+=25; else if(roe>=12) finS+=15; else if(roe>=8) finS+=8;
    if(de<=0.5) finS+=15; else if(de<=1) finS+=10; else if(de<=2) finS+=5; finS=Math.min(95,finS);
    var dirS=dirs.length?88:60;
    var overall=Math.round((legal+forensic+gov+finS+dirS)/5);
    var items=[];
    function add(area, level, finding, why, advice){ items.push({area:area, level:level, finding:finding, why:why, advice:advice}); }
    if(d.cirp_status && !/^(none|no|nil|null)$/i.test(String(d.cirp_status))) add('Legal','critical','Insolvency (CIRP) status on record: '+d.cirp_status+'.','Investors and lenders will not proceed while insolvency proceedings are open.','Obtain the current NCLT position in writing and a legal plan to close it.');
    if(comp.defaulter) add('Legal','critical','Filings data flags the company on a defaulter list.','A defaulter flag blocks IPO, pre-IPO and most bank funding until cleared.','Get a no-dues or clarification letter from the lender concerned and keep it on file.');
    if(against>5 || pending>3) add('Legal', against>15||pending>10?'critical':'watch', against+' case(s) against the company, '+pending+' pending.','Pending litigation is disclosed in every offer document and priced in by investors.','Prepare a case-wise status note with likely outcome and exposure.');
    if(open.length>5) add('Charges','watch',open.length+' open charges registered'+(open[0]&&open[0].charge_holder?' (largest lenders include '+open.slice(0,3).map(function(c){return c.charge_holder;}).filter(Boolean).join(', ')+')':'')+'.','Many open charges suggest heavy secured borrowing and restrict fresh funding.','Confirm which loans are repaid and file charge satisfaction (Form CHG-4) for them.');
    else if(open.length) add('Charges','normal',open.length+' open charge(s) registered.','Normal for a borrowing company.','Keep satisfaction filings up to date as loans are repaid.');
    if((comp.msme_delays||0)>0) add('Payments to MSMEs','watch','Delayed payments to MSME suppliers are reported ('+comp.msme_delays+').','Under Section 43B(h) of the Income Tax Act, payments to MSME suppliers beyond the agreed period (maximum 45 days) are disallowed as expenses until paid; delays also show up in diligence.','Clear MSME dues within 45 days and track them monthly.');
    var gst=String(comp.gst_status||''); if(gst && !/active/i.test(gst)) add('GST','critical','GST registration status: '+gst+'.','An inactive or cancelled GST registration disrupts sales and is a red flag in diligence.','Check the GST portal status and file any pending returns to restore it.');
    var roc=String(comp.roc_filing_status||''); if(roc && /(non|default|pending|overdue)/i.test(roc)) add('ROC filings','watch','ROC filing status: '+roc+'.','Late annual filings attract penalties and are checked in every IPO diligence.','File pending forms (AOC-4, MGT-7) and keep a filing calendar.');
    if(comp.epfo_registered===false && dirs.length) add('EPFO','watch','No EPFO registration found in the data.','Companies above 20 employees must register; gaps are checked in diligence.','Confirm employee count and registration status with your CA.');
    if(dirs.length && dirs.length<3) add('Board','watch','Only '+dirs.length+' active director(s).','A public limited company needs at least three directors, and listed companies need independent directors.','Plan board additions, including independent directors, before an IPO.');
    var rpt=(d.related_party_transactions||[]).length; if(rpt) add('Related parties','watch',rpt+' related-party transaction(s) disclosed.','Related-party dealings are among the first things investors test for fairness.','Make sure each is at arm\u2019s length, board-approved and documented.');
    if(de>2) add('Leverage','critical','Debt/equity '+de+'×.','High leverage limits fresh borrowing and weighs on valuation.','Plan debt reduction or equity infusion before approaching investors.');
    else if(de>1) add('Leverage','watch','Debt/equity '+de+'×.','Lenders and investors prefer under 1.0×.','Link new borrowing to clear repayment sources.');
    var cr=(d.credit_ratings||[])[0]; var rating=cr?[cr.rating||cr.rating_assigned||'', cr.agency||cr.rating_agency||'', cr.date||cr.rating_date||''].filter(Boolean).join(' · '):'';
    if(!items.filter(function(i){return i.level!=='normal';}).length) add('Overall','normal','No risk items flagged in the filings data.','','Keep filings, charges and statutory payments current.');
    var order={critical:0,watch:1,normal:2}; items.sort(function(a,b){ return order[a.level]-order[b.level]; });
    var band = overall>=80?'Low risk':overall>=65?'Moderate risk':overall>=50?'Elevated risk':'High risk';
    return { overall:overall, band:band,
      modules:[{k:'legal',label:'Legal',v:legal},{k:'forensic',label:'Forensic',v:forensic},{k:'directors',label:'Directors',v:dirS},{k:'financial',label:'Financial',v:finS},{k:'governance',label:'Governance',v:gov}],
      facts:{openCharges:open.length, directors:dirs.length, casesAgainst:against, pending:pending, msmeDelays:comp.msme_delays||0, defaulter:!!comp.defaulter, gst:gst||null, rating:rating||null},
      items:items, method:'Same scoring as ipowork Risk Desk: Legal, Forensic, Directors, Financial and Governance scores from MCA/Probe42 data, averaged.' };
  };

  /* ---------- sector from the CIN's industry code (NIC-2004, characters 2–6) ---------- */
  var NIC={1:'Agriculture',2:'Agriculture',5:'Fisheries',10:'Mining',11:'Oil & gas',12:'Mining',13:'Mining',14:'Mining',15:'Food & beverages',16:'Tobacco',17:'Textiles',18:'Apparel',19:'Leather & footwear',
    20:'Wood products',21:'Paper & packaging',22:'Printing & publishing',23:'Petroleum products',24:'Chemicals',25:'Rubber & plastics',26:'Building materials',27:'Metals',28:'Metal products',29:'Industrial machinery',
    30:'Computers & office equipment',31:'Electrical equipment',32:'Electronics',33:'Medical & precision instruments',34:'Automobiles & auto components',35:'Transport equipment',36:'Furniture & other manufacturing',37:'Recycling',
    40:'Power & gas',41:'Water',45:'Construction & infrastructure',50:'Automobile trade',51:'Wholesale trade',52:'Retail',55:'Hotels & restaurants',60:'Transport & logistics',61:'Shipping',62:'Aviation',63:'Logistics',64:'Telecom',
    65:'Financial services',66:'Insurance',67:'Financial services',70:'Real estate',71:'Equipment rental',72:'IT & software',73:'Research & development',74:'Business services',75:'Public services',80:'Education',85:'Healthcare',
    90:'Waste management',91:'Associations',92:'Media & entertainment',93:'Other services'};
  E.nicSector = function(cin){ var m=String(cin||'').toUpperCase().match(/^[LU](\d{5})/); if(!m) return ''; if(m[1].slice(0,4)==='2423') return 'Pharmaceuticals'; return NIC[+m[1].slice(0,2)]||''; };

  /* ---------- balance-sheet detail (Worker patch P1 "profiles") ---------- */
  function pick(o, re){ if(!o) return null; var ks=Object.keys(o); for(var i=0;i<re.length;i++){ for(var j=0;j<ks.length;j++){ if(re[i].test(ks[j]) && isFinite(o[ks[j]])) return +o[ks[j]]; } } return null; }
  function sumOf(o, re){ if(!o) return null; var t=null; Object.keys(o).forEach(function(k){ if(re.test(k) && isFinite(o[k])){ t=(t||0)+(+o[k]); } }); return t; }
  function yearDetail(Y){
    var L=Y.liabilities||{}, A=Y.assets||{}, T=Y.subtotals||{}, P=Y.pnl||{}, C=Y.cash_flow||{};
    var lt=pick(L,[/^long_term_borrowings$/,/non_current_borrowings/,/long_term_(debt|loans)/]), st=pick(L,[/^short_term_borrowings$/,/^current_borrowings$/,/short_term_(debt|loans)/]);
    var cm=pick(L,[/current_maturit/]), deb=sumOf(L,/debenture|bond|ncd/), cp=pick(L,[/commercial_paper/]), lease=sumOf(L,/lease/);
    var unsec=sumOf(L,/unsecured|from_related|from_director|from_promoter/);
    var totDebt=pick(T,[/^total_debt$/,/^total_borrowings$/]); var parts=(lt||0)+(st||0)+(cm||0);
    if(totDebt===null && (lt!==null||st!==null)) totDebt=Math.round(parts*100)/100;
    var eq=pick(T,[/^total_equity$/,/^net_worth$/,/shareholders?_funds/]); var shc=pick(L,[/^share_capital$/,/equity_share_capital/]), res=pick(L,[/reserves/,/^other_equity$/]);
    if(eq===null && (shc!==null||res!==null)) eq=(shc||0)+(res||0);
    var intang=sumOf(A,/intangible|goodwill/)||0;
    var fc=pick(P,[/^interest$/,/finance_?costs?/,/interest_expense/]), dep=pick(P,[/depreciation|amortis/]), oi=pick(P,[/^other_income$/]), pbt=pick(P,[/profit_before_tax/]);
    return { fy:Y.fy, lt:lt, st:st, cm:cm, deb:deb, cp:cp, lease:lease, unsecured:unsec, debt:totDebt, equity:eq, shareCapital:shc, reserves:res, intangibles:intang,
      revenue:pick(P,[/^net_revenue$/,/revenue_from_operations/,/total_revenue/]), ebitda:pick(P,[/^operating_profit$/,/^ebitda$/]), fc:fc, dep:dep, oi:oi, pbt:pbt, pat:pick(P,[/profit_after_tax/,/^net_profit$/]),
      receivables:pick(A,[/trade_receivables/,/sundry_debtors/]), inventory:pick(A,[/inventor/]), payables:pick(L,[/trade_payables/,/sundry_creditors/]), cash:pick(A,[/cash_and_bank/,/cash_and_cash_equivalents/]),
      cfo:pick(C,[/operating_activities/,/from_operations/]), capex:(function(){ var v=pick(C,[/purchase_of_(fixed|property|tangible)/,/capital_expenditure/]); return v===null?null:Math.abs(v); })(),
      nta: eq!==null ? Math.round((eq-intang)*100)/100 : null,
      opProfit: (pbt!==null && fc!==null) ? Math.round((pbt+fc-(oi||0))*100)/100 : null };
  }
  E.detailFrom = function(a){ var y=a&&a.profiles&&a.profiles.years; if(!y||!y.length) return null; return y.map(yearDetail).filter(function(d){ return d.fy; }); };

  /* ---------- Debt profile ---------- */
  E.debtProfile = function(a, risk, b){
    var D=E.detailFrom(a), f=(a&&a.financials)||{}, out={detailed:!!(D&&D.length), types:[], lenders:[], ratings:[], metrics:{}, advice:[]};
    var Y=D&&D[0], P=D&&D[1];
    out.years = D ? D.slice(0,3).map(function(d){return d.fy;}).reverse() : [];
    function row(label, key, note){ if(!D) return; var vals={}, any=false; D.slice(0,3).forEach(function(d){ var v=d[key]; vals[d.fy]=v; if(v) any=true; }); if(any) out.types.push({label:label, key:key, values:vals, note:note||''}); }
    row('Long-term borrowings (term loans etc.)','lt','Repayable after 12 months');
    row('Short-term borrowings (working capital: CC / OD / WCDL)','st','Repayable within 12 months');
    row('Current maturities of long-term debt','cm','Term-loan instalments due within 12 months');
    row('Debentures / NCDs / bonds','deb','Market borrowings');
    row('Commercial paper','cp','Short-term market borrowings');
    row('Unsecured / related-party loans','unsecured','From promoters, directors or group companies');
    row('Lease liabilities','lease','Ind AS 116 leases');
    var debt = Y ? Y.debt : (f.total_debt!=null ? +f.total_debt : null);
    out.total = debt; out.totalPrev = P ? P.debt : null;
    var ebitda = Y&&Y.ebitda!=null ? Y.ebitda : (f.ebitda_cr!=null?+f.ebitda_cr:null), eq = Y&&Y.equity!=null ? Y.equity : (f.net_worth!=null?+f.net_worth:null);
    var fc = Y ? Y.fc : null, cash = Y ? Y.cash : (f.cash_and_bank!=null?+f.cash_and_bank:null);
    var M=out.metrics;
    if(debt!=null && eq) M.de = Math.round(debt/eq*100)/100;
    if(debt!=null && ebitda>0) M.debtEbitda = Math.round(debt/ebitda*10)/10;
    if(fc>0 && ebitda!=null) M.icr = Math.round(ebitda/fc*10)/10; else if(f.interest_coverage!=null) M.icr = +f.interest_coverage;
    if(fc>0 && debt>0){ var avg = (out.totalPrev>0) ? (debt+out.totalPrev)/2 : debt; M.costOfDebt = Math.round(fc/avg*1000)/10; }
    if(Y && debt>0){ var shortT=(Y.st||0)+(Y.cm||0); M.shortShare = Math.round(shortT/debt*100); }
    if(debt!=null && cash!=null) M.netDebt = Math.round((debt-cash)*100)/100;
    if(debt!=null && ebitda>0 && eq>0){ var cap=Math.min(ebitda*3-debt, eq*1.0-debt); M.capacity = Math.round(cap*10)/10; }
    // secured lenders (open charges)
    ((risk&&risk.charges)||[]).filter(function(c){ return String(c.status||'').toLowerCase().indexOf('open')>-1; }).forEach(function(c){
      out.lenders.push({name:c.charge_holder||'—', amount:c.amount?Math.round(parseFloat(c.amount)/1e7*100)/100:null, date:c.date_of_creation||''}); });
    out.lenders.sort(function(x,y){ return (y.amount||0)-(x.amount||0); });
    var rt=(a&&a.profiles&&a.profiles.credit_ratings&&a.profiles.credit_ratings.length)?a.profiles.credit_ratings:((risk&&risk.credit_ratings)||[]);
    out.ratings = rt.slice(0,6).map(function(r){ return {agency:r.rating_agency||r.agency||'', rating:r.rating||r.rating_assigned||r.current_rating||'', instrument:r.instrument||r.instrument_type||r.facility||'', amount:r.amount?Math.round(parseFloat(r.amount)/1e7*100)/100:null, date:r.rating_date||r.date||''}; });
    // advice
    var A=out.advice;
    if(M.debtEbitda!=null && M.debtEbitda>3) A.push({lvl:'watch', t:'Debt is '+M.debtEbitda+'× EBITDA.', a:'Lenders usually cap at about 3×. Link fresh borrowing to EBITDA growth, or plan an equity raise.'});
    if(M.shortShare!=null && M.shortShare>60) A.push({lvl:'watch', t:M.shortShare+'% of debt falls due within 12 months.', a:'High refinancing risk. Consider moving part of working-capital debt to a term loan or an NCD.'});
    if(M.costOfDebt!=null && M.costOfDebt>11) A.push({lvl:'watch', t:'Estimated cost of debt '+M.costOfDebt+'%.', a:'Compare with current bank and NBFC rates; a credit rating or refinancing may lower it.'});
    if(!out.ratings.length && debt>25) A.push({lvl:'info', t:'No credit rating found, with '+E.crore(debt)+' of debt.', a:'A bank-loan rating can reduce borrowing cost and is needed for NCDs or CP.'});
    if(M.icr!=null && M.icr<3) A.push({lvl:'watch', t:'Interest cover '+M.icr+'×.', a:'Keep new borrowing modest until earnings grow; lenders look for 3× or more.'});
    if(M.capacity!=null) A.push({lvl:M.capacity>0?'info':'watch', t: M.capacity>0 ? 'Room for roughly '+E.crore(M.capacity)+' more debt at 3× EBITDA and debt/equity of 1.0.' : 'Debt is already at or above 3× EBITDA or debt/equity of 1.0.', a: M.capacity>0 ? 'An indicative ceiling, not a sanction; each lender sets its own limits.' : 'Equity or internal accruals are the better source for the next round of funding.'});
    if(!out.detailed) A.push({lvl:'info', t:'Borrowing split by type isn\u2019t available yet.', a:'Run AIRA again after ipowork\u2019s data update to see term loans, working capital, NCDs and other lines separately.'});
    return out;
  };

  /* ---------- Equity profile ---------- */
  function shareholding(extra){
    if(!extra) return null; var found=null;
    Object.keys(extra).forEach(function(k){ if(found) return; var v=extra[k]; var arr=Array.isArray(v)?v:(v&&typeof v==='object'?(Array.isArray(v.data)?v.data:Object.keys(v).map(function(x){ return {category:x, percentage:v[x]}; })):null);
      if(!arr) return; var rows=arr.map(function(r){ if(!r||typeof r!=='object') return null; var cat=r.category||r.shareholder_category||r.type||r.name||''; var p=parseFloat(r.percentage!=null?r.percentage:(r.percent!=null?r.percent:(r.share_percentage!=null?r.share_percentage:r.holding)));
        return cat&&isFinite(p)?{category:String(cat),pct:p}:null; }).filter(Boolean);
      if(rows.length) found=rows; });
    return found;
  }
  E.equityProfile = function(a, b){
    var D=E.detailFrom(a), f=(a&&a.financials)||{}, pr=(a&&a.profiles)||{}, out={detailed:!!(D&&D.length), years:[], rows:[], metrics:{}, advice:[]};
    var paid=pr.paid_up_capital_cr!=null?pr.paid_up_capital_cr:(a&&a.paid_up_capital?Math.round(parseFloat(a.paid_up_capital)/1e7*10000)/10000:null);
    var auth=pr.authorised_capital_cr!=null?pr.authorised_capital_cr:(a&&a.authorised_capital?Math.round(parseFloat(a.authorised_capital)/1e7*10000)/10000:null);
    var M=out.metrics; M.paidUp=paid; M.authorised=auth; if(paid!=null&&auth!=null) M.headroom=Math.round((auth-paid)*10000)/10000;
    if(D){ out.years=D.slice(0,3).map(function(d){return d.fy;}).reverse();
      var ys=D.slice(0,3), vals=function(fn){ var o={}; ys.forEach(function(d,i){ o[d.fy]=fn(d,ys[i+1]); }); return o; };
      out.rows.push({label:'Net worth', unit:'cr', type:'ACTUAL', values:vals(function(d){return d.equity;})});
      out.rows.push({label:'Share capital', unit:'cr', type:'ACTUAL', values:vals(function(d){return d.shareCapital;})});
      out.rows.push({label:'Reserves & surplus', unit:'cr', type:'ACTUAL', values:vals(function(d){return d.reserves;})});
      out.rows.push({label:'Net tangible assets', unit:'cr', type:'DERIVED', values:vals(function(d){return d.nta;}), note:'Net worth minus intangible assets.'});
      /* ROE = PAT ÷ average net worth; when net worth more than doubled in the year (fresh equity, bonus, merger),
         the average is distorted, so year-end net worth is used and the year is marked */
      var sharp={};
      out.rows.push({label:'Return on equity', unit:'%', type:'DERIVED', values:vals(function(d,p){ if(d.pat==null||!d.equity) return null;
        if(p&&p.equity>0&&d.equity>2*p.equity){ sharp[d.fy]=1; return Math.round(d.pat/d.equity*1000)/10; }
        var base=(p&&p.equity)?(d.equity+p.equity)/2:d.equity; return Math.round(d.pat/base*1000)/10; }), note:'PAT ÷ average net worth.'});
      out.roeSharp=sharp; if(Object.keys(sharp).length) out.rows[4].note='PAT ÷ average net worth. * Year-end net worth used for '+Object.keys(sharp).join(', ')+' — net worth more than doubled that year.';
      var Y=D[0], P=D[1]; M.roe=out.rows[4].values[Y.fy]; M.roeSharp=!!sharp[Y.fy]; if(Y.equity&&P&&P.equity) M.nwGrowth=Math.round((Y.equity-P.equity)/Math.abs(P.equity)*1000)/10;
      if(Y.shareCapital!=null&&P&&P.shareCapital!=null&&Y.shareCapital-P.shareCapital>=0.05) M.capitalAdded=Math.round((Y.shareCapital-P.shareCapital)*100)/100;
      if(Y.reserves!=null&&Y.equity) M.retained=Math.round(Y.reserves/Y.equity*100);
    } else { if(f.net_worth!=null) M.netWorth=+f.net_worth; if(f.roe!=null) M.roe=+f.roe; }
    var sh=shareholding(pr.extra); out.shareholding=sh;
    if(sh){ var pro=sh.filter(function(r){return /promoter/i.test(r.category);}); if(pro.length) M.promoterPct=Math.round(pro.reduce(function(s,r){return s+r.pct;},0)*10)/10; }
    if(b&&b.valuation){ M.raise10=Math.round(b.valuation.mid*0.10); M.raise20=Math.round(b.valuation.mid*0.20); }
    var A=out.advice;
    if(M.capitalAdded) A.push({lvl:'info', t:'Share capital rose by '+E.crore(M.capitalAdded)+' in '+out.years[out.years.length-1]+' \u2014 new shares, a bonus issue or a conversion.', a:'Keep the allotment filings (PAS-3 / SH-7) and valuation reports ready; investors will ask about every recent equity change.'});
    if(M.headroom!=null && paid!=null && M.headroom < paid*0.25) A.push({lvl:'watch', t:'Authorised capital headroom is small ('+E.crore(M.headroom)+').', a:'Increase authorised capital (an ordinary resolution and Form SH-7) before any share issue or IPO.'});
    if(M.roe!=null && M.roe<12) A.push({lvl:'watch', t:'Return on equity '+M.roe+'%.', a:'Investors usually look for 15% or more; margin and asset turns are the levers.'});
    else if(M.roe!=null && M.roe>=15) A.push({lvl:'info', t:'Return on equity '+M.roe+'% — attractive to equity investors.', a:'Keep it visible in your investor story.'});
    if(M.promoterPct!=null){ if(M.promoterPct>=90) A.push({lvl:'info', t:'Promoters hold '+M.promoterPct+'%.', a:'There is room to bring in pre-IPO or strategic investors while keeping control.'}); else if(M.promoterPct<51) A.push({lvl:'watch', t:'Promoter holding '+M.promoterPct+'%.', a:'Plan dilution carefully; lock-in and control need attention before an IPO.'}); }
    if(M.raise10) A.push({lvl:'info', t:'A 10–20% stake at the indicative mid valuation is about '+E.crore(M.raise10)+'–'+E.crore(M.raise20)+'.', a:'Indicative only; actual pricing depends on investors and market conditions.'});
    if(!sh) A.push({lvl:'info', t:'Shareholding pattern not available in the data we hold.', a:'Share your latest MGT-7 or shareholding with your adviser for an equity plan.'});
    return out;
  };

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
      y.ov = {}; OVERRIDABLE_IN.forEach(function(k){ var v=num(r['ov_'+k]); if(v!==null) y.ov[k]=v; });
      (byCin[cin] = byCin[cin] || {cin:cin, rows:[], meta:{}}).rows.push(y);
      var meta = byCin[cin].meta;
      ['company_name','sector','city','filed_on'].forEach(function(k){ if(r[k]) meta[k]=r[k]; });
      if(r.aira_score!=='' && r.aira_score!==undefined) meta.aira = num(r.aira_score);
      if(r.public_company) meta.public_company = yes(r.public_company)?true:(no(r.public_company)?false:null);
      if(r.auditor_peer_reviewed) meta.auditor = yes(r.auditor_peer_reviewed)?true:(no(r.auditor_peer_reviewed)?false:null);
      if(r.independent_directors!=='' && r.independent_directors!==undefined) meta.indep = num(r.independent_directors);
      if(r.delayed_filings) meta.delayed = yes(r.delayed_filings)?true:(no(r.delayed_filings)?false:null);
      if(r.active_mandate) meta.activeMandate = yes(r.active_mandate);
      if(r.op_basis) meta.opBasis = r.op_basis;
      if(r.auditor_name) meta.auditorName = String(r.auditor_name).trim().slice(0,120);
      if(r.nta_basis) meta.ntaBasis = r.nta_basis;
    });
    var briefs = Object.keys(byCin).map(function(cin){
      var C = byCin[cin], meta = C.meta;
      var years = C.rows.sort(function(a,b){ return a.year-b.year; }).filter(function(y,i,a){ return !i || y.year!==a[i-1].year; });
      years.forEach(function(y){ y.m = yearMetrics(y); applyOverrides(y); });
      years.forEach(function(y,i){ y.m.growth = i ? r1(pct(y.revenue, years[i-1].revenue)) : null;
        y.m.ccc = (y.m.receivable_days!==null&&y.m.inventory_days!==null&&y.m.payable_days!==null) ? y.m.receivable_days+y.m.inventory_days-y.m.payable_days : null; });
      var last = years[years.length-1], prev = years.length>1 ? years[years.length-2] : null;
      var flags = {public_company: meta.public_company===undefined?null:meta.public_company, auditor: meta.auditor===undefined?null:meta.auditor,
                   indep: meta.indep===undefined?null:meta.indep, delayed: meta.delayed===undefined?null:meta.delayed};
      var c = {aira: meta.aira===undefined?null:meta.aira, activeMandate: !!meta.activeMandate};
      flags.opBasis = meta.opBasis||''; flags.ntaBasis = meta.ntaBasis||''; flags.auditorName = meta.auditorName||'';
      var elig = eligibility(years, flags);
      var stg = stage(c, last, prev, elig);
      var prevBrief = prevBriefs[cin] || null;
      var health = METRICS.map(function(M){
        var vals = {}; years.slice(-3).forEach(function(y){ var v = (M.k in y.m) ? y.m[M.k] : y[M.k]; vals[fyLabel(y.year)] = (v===undefined?null:v); });
        var fromMca = years.slice(-3).some(function(y){ return y.m._from && y.m._from[M.k]; });
        return {k:M.k, label:M.label, unit:M.unit, type:M.type, good:M.good, method:M.method+(fromMca?' Where our inputs weren\u2019t filed, the figure is taken from MCA ratio data.':''), values:vals};
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
