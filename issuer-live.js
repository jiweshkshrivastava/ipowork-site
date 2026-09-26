/* ipowork Issuer Intelligence — Live Business Data (v1, private, on-device)
 *
 * The issuer uploads monthly exports (Excel or CSV, e.g. from Tally). Files are read
 * in this browser only and are NEVER sent to ipowork. Only summary figures
 * (monthly totals, customer/supplier totals, ageing buckets) are kept, in this
 * browser's storage, per company. The issuer can download or delete them anytime.
 *
 * Every derived number is labelled: ACTUAL (from the upload), DERIVED (calculated),
 * ESTIMATED (uses an assumption, stated). Alerts are for management attention only.
 */
(function(){
  var L = window.IPWLive = {};
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var KEY = function(cin){ return 'ipw_live_v1_'+cin; };

  /* ---------------- modules & column aliases ---------------- */
  var MODS = {
    sales:  { title:'Sales register', hint:'One row per invoice: date, customer, amount (before GST). Product and quantity optional.',
              cols:{ date:['date','invoicedate','voucherdate','billdate','docdate'], party:['customer','party','partyname','customername','buyer','particulars','ledger','name'],
                     amount:['amount','value','taxablevalue','netamount','salesamount','invoicevalue','basicamount','total','credit'], product:['product','item','itemname','stockitem','sku','description'] },
              need:['date','party','amount'], template:'date,customer,product,amount\n2026-08-03,Alpha Motors Pvt Ltd,Bracket A12,452000\n2026-08-05,Beta Auto Ltd,Housing H4,318500\n' },
    recv:   { title:'Receivables (outstanding)', hint:'What customers owe you today: customer, invoice date, due date, amount outstanding.',
              cols:{ party:['customer','party','partyname','customername','particulars','ledger','name'], date:['invoicedate','billdate','date','voucherdate'],
                     due:['duedate','due','dueon'], amount:['outstanding','amountoutstanding','balance','pending','pendingamount','amount','closingbalance','debit'] },
              need:['party','amount'], template:'customer,invoice_date,due_date,outstanding\nAlpha Motors Pvt Ltd,2026-06-12,2026-07-12,452000\nBeta Auto Ltd,2026-08-05,2026-09-04,318500\n' },
    pay:    { title:'Payables (outstanding)', hint:'What you owe suppliers today: supplier, invoice date, due date, amount outstanding.',
              cols:{ party:['supplier','vendor','party','partyname','particulars','ledger','name'], date:['invoicedate','billdate','date','voucherdate'],
                     due:['duedate','due','dueon'], amount:['outstanding','amountoutstanding','balance','pending','pendingamount','amount','closingbalance','credit'] },
              need:['party','amount'], template:'supplier,invoice_date,due_date,outstanding\nSteel Traders,2026-07-20,2026-08-19,210000\n' },
    exp:    { title:'Purchases & expenses', hint:'One row per bill or month: date, category, amount. Categories: raw material, salary, power, rent, freight, interest, other.',
              cols:{ date:['date','voucherdate','billdate','month'], category:['category','head','type','ledger','group','expensehead'], party:['supplier','vendor','party','particulars'],
                     amount:['amount','value','debit','total','netamount'] },
              need:['date','amount'], template:'date,category,supplier,amount\n2026-08-02,raw material,Steel Traders,2100000\n2026-08-31,salary,,640000\n2026-08-31,power,,180000\n' },
    cash:   { title:'Cash & bank', hint:'One row per month (or per day): date, closing balance. Inflows and outflows optional.',
              cols:{ date:['date','month','asof','valuedate'], closing:['closing','closingbalance','balance','bankbalance','cashbalance'],
                     inflow:['inflow','inflows','receipts','credit','deposits'], outflow:['outflow','outflows','payments','debit','withdrawals'] },
              need:['date','closing'], template:'month,inflow,outflow,closing\n2026-06,9800000,9400000,4200000\n2026-07,10100000,10600000,3700000\n2026-08,10400000,10900000,3200000\n' }
  };
  var MATERIAL = /raw|material|purchase|stock|inventory|consum|component|steel|chemical/i;

  /* ---------------- helpers ---------------- */
  function esc(s){ return String(s===null||s===undefined?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function norm(h){ return String(h||'').toLowerCase().replace(/[^a-z]/g,''); }
  function amt(v){
    if(typeof v==='number') return isFinite(v)?v:null;
    var s=String(v||'').trim(); if(!s) return null;
    var neg=/^\(.*\)$/.test(s)||/cr\.?$/i.test(s)&&false;
    s=s.replace(/[₹,\s]|rs\.?|inr|dr\.?$|cr\.?$/gi,'').replace(/[()]/g,'');
    var n=parseFloat(s); return isFinite(n)?(neg?-n:n):null;
  }
  var MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
  function dt(v){
    if(v instanceof Date && !isNaN(v)) return v;
    if(typeof v==='number' && v>20000 && v<80000) return new Date(Math.round((v-25569)*86400000));
    var s=String(v||'').trim(); if(!s) return null; var m;
    if((m=s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/))) return new Date(+m[1],+m[2]-1,+(m[3]||1));
    if((m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))){ var y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[2]-1,+m[1]); }
    if((m=s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,4})[a-z]*[\s-,]*(\d{2,4})/))){ var y2=+m[3]; if(y2<100) y2+=2000; var mo=MON[m[2].toLowerCase()]; if(mo!==undefined) return new Date(y2,mo,+m[1]); }
    if((m=s.match(/^([A-Za-z]{3,4})[a-z]*[\s-,]*(\d{2,4})$/))){ var y3=+m[2]; if(y3<100) y3+=2000; var mo2=MON[m[1].toLowerCase()]; if(mo2!==undefined) return new Date(y3,mo2,1); }
    return null;
  }
  function ym(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  function ymLabel(k){ var p=k.split('-'); return new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'}); }
  function money(x){ if(x===null||x===undefined||!isFinite(x)) return '—'; var a=Math.abs(x), sg=x<0?'−':'';
    if(a>=1e7) return sg+'₹'+(a/1e7).toFixed(2)+' cr'; if(a>=1e5) return sg+'₹'+(a/1e5).toFixed(1)+' L'; return sg+'₹'+Math.round(a).toLocaleString('en-IN'); }
  function pct(x,d){ return x===null||!isFinite(x)?'—':(x>0&&d?'+':'')+(Math.round(x*10)/10)+'%'; }
  function chip(t){ return '<span class="chip '+t+'">'+t+'</span>'; }
  function sum(a){ return a.reduce(function(s,x){return s+(x||0);},0); }
  function daysBetween(a,b){ return Math.round((a-b)/86400000); }

  /* ---------------- file reading (in the browser only) ---------------- */
  function loadXlsx(){ return new Promise(function(ok,bad){ if(window.XLSX) return ok(); var s=document.createElement('script'); s.src=XLSX_URL; s.onload=ok; s.onerror=function(){bad(new Error('Could not load the Excel reader. Save the file as CSV and try again.'));}; document.head.appendChild(s); }); }
  function csvRows(text){
    var lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(function(l){return l.trim();}); if(!lines.length) return [];
    var d=lines[0].split('\t').length>lines[0].split(',').length?'\t':(lines[0].split(';').length>lines[0].split(',').length?';':',');
    return lines.map(function(l){ var out=[],cur='',q=false; for(var i=0;i<l.length;i++){ var c=l[i]; if(q){ if(c==='"'){ if(l[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; } else if(c==='"') q=true; else if(c===d){ out.push(cur); cur=''; } else cur+=c; } out.push(cur); return out.map(function(x){return x.trim();}); });
  }
  async function readFile(file){
    if(/\.(xlsx|xls|xlsm)$/i.test(file.name)){
      await loadXlsx();
      var wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      var ws=wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
    }
    return csvRows(await file.text());
  }
  /* find the header row (Tally exports often have title rows above it) and map columns */
  function mapRows(grid, mod){
    var spec=MODS[mod], best=-1, bestScore=0;
    for(var i=0;i<Math.min(grid.length,15);i++){
      var hs=grid[i].map(norm), score=0;
      Object.keys(spec.cols).forEach(function(k){ if(hs.some(function(h){return spec.cols[k].indexOf(h)>-1;})) score++; });
      if(score>bestScore){ bestScore=score; best=i; }
    }
    if(best<0) return {error:'No header row found. Use the template column names.'};
    var hs=grid[best].map(norm), ix={};
    Object.keys(spec.cols).forEach(function(k){ for(var j=0;j<spec.cols[k].length;j++){ var at=hs.indexOf(spec.cols[k][j]); if(at>-1){ ix[k]=at; break; } } });
    var missing=spec.need.filter(function(k){ return ix[k]===undefined; });
    if(missing.length) return {error:'Missing column(s): '+missing.join(', ')+'. Found: '+grid[best].filter(Boolean).join(', ')};
    var rows=[], skipped=0;
    grid.slice(best+1).forEach(function(r){
      var o={}; Object.keys(ix).forEach(function(k){ o[k]=r[ix[k]]; });
      if(/^(total|grand total|closing balance|opening balance)$/i.test(String(o.party||o.category||'').trim())){ skipped++; return; }
      rows.push(o);
    });
    return {rows:rows, skipped:skipped, header:grid[best].filter(Boolean)};
  }

  /* ---------------- summarising (only these summaries are stored) ---------------- */
  function summarise(mod, rows, asOf){
    var bad=0, out;
    if(mod==='sales'){
      out={months:{}, customers:{}, products:{}};
      rows.forEach(function(r){ var d=dt(r.date), a=amt(r.amount); if(!d||a===null){ bad++; return; }
        var k=ym(d), c=String(r.party||'Unnamed').trim()||'Unnamed', p=String(r.product||'').trim();
        out.months[k]=(out.months[k]||0)+a;
        (out.customers[k]=out.customers[k]||{})[c]=(out.customers[k][c]||0)+a;
        if(p) (out.products[k]=out.products[k]||{})[p]=(out.products[k][p]||0)+a; });
      Object.keys(out.customers).forEach(function(k){ out.customers[k]=capTop(out.customers[k],150); });
      Object.keys(out.products).forEach(function(k){ out.products[k]=capTop(out.products[k],80); });
    } else if(mod==='recv'||mod==='pay'){
      out={asOf:asOf.toISOString().slice(0,10), total:0, buckets:{notDue:0,d30:0,d60:0,d90:0,d90p:0}, parties:{}, count:0, undated:0};
      rows.forEach(function(r){ var a=amt(r.amount); if(a===null||a===0){ if(a===null) bad++; return; }
        var due=dt(r.due), inv=dt(r.date); if(!due&&inv) due=new Date(inv.getTime()+30*86400000);
        var od=due?daysBetween(asOf,due):null; if(od===null) out.undated++;
        var b=od===null||od<=0?'notDue':od<=30?'d30':od<=60?'d60':od<=90?'d90':'d90p';
        out.buckets[b]+=a; out.total+=a; out.count++;
        var pn=String(r.party||'Unnamed').trim()||'Unnamed'; var P=out.parties[pn]=out.parties[pn]||{total:0,over90:0}; P.total+=a; if(b==='d90p') P.over90+=a; });
      var top=Object.keys(out.parties).sort(function(a,b){return out.parties[b].total-out.parties[a].total;}).slice(0,15), keep={}; top.forEach(function(k){ keep[k]=out.parties[k]; }); out.parties=keep;
    } else if(mod==='exp'){
      out={months:{}};
      rows.forEach(function(r){ var d=dt(r.date), a=amt(r.amount); if(!d||a===null){ bad++; return; }
        var k=ym(d), c=String(r.category||'other').trim().toLowerCase()||'other'; var cat=MATERIAL.test(c)?'material':(/salar|wage|staff|employ|payroll/.test(c)?'staff':(/interest|finance|bank charge/.test(c)?'interest':c));
        var M=out.months[k]=out.months[k]||{}; M[cat]=(M[cat]||0)+a; });
    } else if(mod==='cash'){
      out={months:{}};
      rows.forEach(function(r){ var d=dt(r.date), c=amt(r.closing); if(!d||c===null){ bad++; return; }
        var k=ym(d), M=out.months[k]=out.months[k]||{closing:null,inflow:0,outflow:0,at:0};
        if(d.getTime()>=M.at){ M.closing=c; M.at=d.getTime(); }
        var i=amt(r.inflow), o=amt(r.outflow); if(i!==null) M.inflow+=Math.abs(i); if(o!==null) M.outflow+=Math.abs(o); });
      Object.keys(out.months).forEach(function(k){ delete out.months[k].at; });
    }
    return {data:out, bad:bad};
  }
  function capTop(obj,n){ var ks=Object.keys(obj).sort(function(a,b){return obj[b]-obj[a];}); if(ks.length<=n) return obj; var o={}, rest=0; ks.forEach(function(k,i){ if(i<n) o[k]=obj[k]; else rest+=obj[k]; }); o['(all others)']=rest; return o; }
  function merge(store, mod, data){
    if(mod==='sales'){ var s=store.sales=store.sales||{months:{},customers:{},products:{}}; Object.keys(data.months).forEach(function(k){ s.months[k]=data.months[k]; s.customers[k]=data.customers[k]||{}; if(data.products[k]) s.products[k]=data.products[k]; }); }
    else if(mod==='exp'){ var e=store.exp=store.exp||{months:{}}; Object.keys(data.months).forEach(function(k){ e.months[k]=data.months[k]; }); }
    else if(mod==='cash'){ var c=store.cash=store.cash||{months:{}}; Object.keys(data.months).forEach(function(k){ c.months[k]=data.months[k]; }); }
    else { store[mod+'Prev']=store[mod]||null; store[mod]=data; }
  }

  /* ---------------- analytics ---------------- */
  function lastMonths(obj,n){ return Object.keys(obj||{}).sort().slice(-n); }
  L.compute = function(store, brief){
    var K={}, alerts=[], S=store.sales, E=store.exp, C=store.cash, R=store.recv, P=store.pay;
    function alert(level, area, what, why, look){ alerts.push({level:level, area:area, what:what, why:why, look:look}); }
    if(S && Object.keys(S.months).length){
      var ks=lastMonths(S.months,24), last=ks[ks.length-1], l12=ks.slice(-12), l3=ks.slice(-3), p3=ks.slice(-6,-3);
      K.salesMonths=ks.map(function(k){return {k:k,v:S.months[k]};}); K.lastMonth=last; K.lastSales=S.months[last];
      K.ttm=sum(l12.map(function(k){return S.months[k];})); K.l3=sum(l3.map(function(k){return S.months[k];}));
      K.runRate=K.l3/Math.max(1,l3.length)*12;
      if(p3.length===3) K.growth3=(K.l3-sum(p3.map(function(k){return S.months[k];})))/sum(p3.map(function(k){return S.months[k];}))*100;
      var yAgo=(+last.slice(0,4)-1)+last.slice(4); if(S.months[yAgo]) K.yoy=(K.lastSales-S.months[yAgo])/S.months[yAgo]*100;
      var prev3=ks.slice(-4,-1); if(prev3.length===3){ var av=sum(prev3.map(function(k){return S.months[k];}))/3; K.vsAvg=(K.lastSales-av)/av*100;
        if(K.vsAvg<-25) alert('critical','Sales','Sales in '+ymLabel(last)+' were '+pct(K.vsAvg)+' against the previous 3-month average.','A sharp monthly drop is often the first sign of a lost order or customer.','Which customers or products fell, and whether it is timing or lasting.');
        else if(K.vsAvg<-15) alert('watch','Sales','Sales in '+ymLabel(last)+' were '+pct(K.vsAvg)+' against the previous 3-month average.','A sustained dip affects cash and this year\u2019s numbers.','Which customers or products fell.'); }
      var cust={}; l12.forEach(function(k){ var m=S.customers[k]||{}; Object.keys(m).forEach(function(c){ cust[c]=(cust[c]||0)+m[c]; }); });
      var top=Object.keys(cust).filter(function(c){return c!=='(all others)';}).sort(function(a,b){return cust[b]-cust[a];});
      K.topCustomers=top.slice(0,5).map(function(c){ return {name:c, v:cust[c], share:cust[c]/K.ttm*100}; });
      K.top1=K.topCustomers[0]?K.topCustomers[0].share:null; K.top5=sum(K.topCustomers.map(function(x){return x.share;}));
      if(K.top1!==null){ if(K.top1>40) alert('critical','Customer concentration',K.topCustomers[0].name+' is '+pct(K.top1)+' of sales over the last 12 months.','Investors and lenders treat one customer above 30–40% as a key risk.','Contract length, renewal terms and plans to widen the customer base.');
        else if(K.top1>25) alert('watch','Customer concentration',K.topCustomers[0].name+' is '+pct(K.top1)+' of sales over the last 12 months.','Dependence on one customer is checked in every diligence.','How secure this customer is, and the next-largest accounts.'); }
      if(brief && brief.headline && brief.headline.revenue){ K.filedRevenue=brief.headline.revenue*1e7; K.vsFiled=(K.runRate-K.filedRevenue)/K.filedRevenue*100; }
      if(K.vsFiled!==undefined && Math.abs(K.vsFiled)>60) alert('watch','Check your upload','Uploaded sales run at about '+money(K.runRate)+' a year, against '+money(K.filedRevenue)+' filed for '+brief.latestFy+'.','A gap this large usually means amounts are in lakhs or thousands instead of rupees, or the file covers only some sales. Alerts below rely on these figures.','Amounts should be in rupees, before GST, covering all invoices for each month.');
    }
    if(R){
      K.recvTotal=R.total; K.recvBuckets=R.buckets; K.recv90=R.total?R.buckets.d90p/R.total*100:null; K.recvAsOf=R.asOf;
      if(K.l3){ K.dso=Math.round(R.total/(K.l3/91)); }
      if(K.recv90!==null){ if(K.recv90>20) alert('critical','Overdue receivables',pct(K.recv90)+' of receivables ('+money(R.buckets.d90p)+') are more than 90 days overdue.','Old overdues often become bad debts and lock up working capital.','Customer-wise follow-up on 90+ day dues, and whether any need provisioning.');
        else if(K.recv90>10) alert('watch','Overdue receivables',pct(K.recv90)+' of receivables are more than 90 days overdue.','Rising old dues tie up cash.','Customer-wise follow-up on 90+ day dues.'); }
      var filedDays=brief&&brief.health?((brief.health.filter(function(h){return h.k==='receivable_days';})[0]||{}).values||{}):{}, fd=filedDays[brief&&brief.latestFy];
      if(K.dso && fd){ K.dsoFiled=fd; K.dsoFiledFy=brief.latestFy; if(K.dso-fd>20) alert('watch','Collections slower than filed',"Customers now take about "+K.dso+" days to pay, against "+fd+" days in your "+brief.latestFy+" accounts.",'Slower collections than last year mean more cash tied up.','Which customers slowed, and whether terms were extended.'); }
      if(store.recvPrev && store.recvPrev.total){ K.recvChange=(R.total-store.recvPrev.total)/store.recvPrev.total*100; }
    }
    if(P){ K.payTotal=P.total; K.pay90=P.total?P.buckets.d90p/P.total*100:null;
      if(K.pay90!==null && K.pay90>25) alert('watch','Supplier dues',pct(K.pay90)+' of payables are more than 90 days overdue.','Long-overdue suppliers can disrupt supply and appear in diligence as stress.','Payment plan for the oldest supplier dues.'); }
    if(E && Object.keys(E.months).length){
      var ek=lastMonths(E.months,3), mat=0, other=0, staff=0, interest=0;
      ek.forEach(function(k){ var M=E.months[k]; Object.keys(M).forEach(function(c){ if(c==='material') mat+=M[c]; else { other+=M[c]; if(c==='staff') staff+=M[c]; if(c==='interest') interest+=M[c]; } }); });
      K.expMonths=ek; K.material3=mat; K.opex3=other;
      var salesSame=S?sum(ek.map(function(k){return S.months[k]||0;})):0;
      if(salesSame>0){ K.grossMargin=(salesSame-mat)/salesSame*100; K.opMargin=(salesSame-mat-other)/salesSame*100; K.staffPct=staff/salesSame*100;
        if(K.opMargin<0) alert('critical','Margins','Estimated operating margin over the last 3 months is '+pct(K.opMargin)+'.','Spending more than sales brings in is not sustainable.','Which cost lines rose, and pricing versus input costs.');
        var fm=brief&&brief.health?((brief.health.filter(function(h){return h.k==='ebitda_margin';})[0]||{}).values||{})[brief.latestFy]:null;
        if(fm!==null && fm!==undefined){ K.marginFiled=fm; if(K.opMargin<fm-5) alert('watch','Margins below filed level','Estimated operating margin '+pct(K.opMargin)+' against '+fm+'% EBITDA margin in your '+brief.latestFy+' accounts.','Margin is one of the first things investors test.','Raw-material prices, pricing and overheads versus last year.'); }
      }
      if(salesSame>0 && K.material3) K.dpo = P ? Math.round(P.total/(mat/91)) : null;
    }
    if(C && Object.keys(C.months).length){
      var ck=lastMonths(C.months,6), lastC=C.months[ck[ck.length-1]]; K.cash=lastC.closing; K.cashMonth=ck[ck.length-1];
      K.cashSeries=ck.map(function(k){return {k:k,v:C.months[k].closing};});
      var l3c=ck.slice(-3).map(function(k){return C.months[k];}), flows=l3c.filter(function(m){return m.inflow||m.outflow;});
      var burn=null;
      if(flows.length) burn=sum(flows.map(function(m){return m.outflow-m.inflow;}))/flows.length;
      else if(ck.length>=2){ var first=C.months[ck[Math.max(0,ck.length-4)]].closing; burn=(first-K.cash)/Math.min(3,ck.length-1); }
      K.burn=burn;
      if(burn!==null && burn>0){ K.runway=K.cash/burn;
        if(K.runway<3) alert('critical','Cash runway','At the last 3 months\u2019 pace, cash covers about '+(Math.round(K.runway*10)/10)+' months.','Short runway limits choices and weakens negotiating position with lenders.','Collections, payment timing and working-capital lines.');
        else if(K.runway<6) alert('watch','Cash runway','At the last 3 months\u2019 pace, cash covers about '+(Math.round(K.runway*10)/10)+' months.','Worth planning funding before it becomes urgent.','Collections and working-capital limits.'); }
    }
    if(!alerts.length && (S||R||C)) alerts.push({level:'normal', area:'All checks', what:'No alerts from the data you uploaded.', why:'', look:''});
    var order={critical:0,watch:1,normal:2}; alerts.sort(function(a,b){return order[a.level]-order[b.level];});
    return {K:K, alerts:alerts};
  };

  /* what changed since the previous upload */
  function changes(now, prev){
    if(!prev) return [];
    var out=[];
    function add(label, a, b, fmt, goodUp){ if(a===undefined||b===undefined||a===null||b===null) return; var d=a-b; if(Math.abs(d)<(fmt==='days'?3:fmt==='pct'?1:Math.abs(b)*0.03)) return;
      out.push({dir:(d>0)===goodUp?'up':'down', title:label+': '+(fmt==='money'?money(b)+' → '+money(a):fmt==='days'?b+' → '+a+' days':pct(b)+' → '+pct(a))}); }
    add('Last month\u2019s sales', now.lastSales, prev.lastSales, 'money', true);
    add('Receivable days', now.dso, prev.dso, 'days', false);
    add('Receivables 90+ days overdue', now.recv90, prev.recv90, 'pct', false);
    add('Largest customer share', now.top1, prev.top1, 'pct', false);
    add('Cash balance', now.cash, prev.cash, 'money', true);
    add('Estimated operating margin', now.opMargin, prev.opMargin, 'pct', true);
    return out.slice(0,5);
  }

  /* ---------------- storage ---------------- */
  function load(cin){ try{ return JSON.parse(localStorage.getItem(KEY(cin))||'null')||{v:1,history:[]}; }catch(e){ return {v:1,history:[]}; } }
  function save(cin, store){ try{ localStorage.setItem(KEY(cin), JSON.stringify(store)); return true; }catch(e){ return false; } }
  function snapshot(K){ return {at:new Date().toISOString(), lastSales:K.lastSales||null, dso:K.dso||null, recv90:K.recv90!==undefined?K.recv90:null, top1:K.top1!==undefined?K.top1:null, cash:K.cash!==undefined?K.cash:null, opMargin:K.opMargin!==undefined?K.opMargin:null}; }

  /* ---------------- rendering ---------------- */
  function bars(series, fmt){
    if(!series||!series.length) return '';
    var max=Math.max.apply(null,series.map(function(x){return Math.abs(x.v||0);}))||1;
    return '<div class="lv-bars" role="img" aria-label="Monthly chart">'+series.slice(-12).map(function(x){ var h=Math.max(2,Math.round(Math.abs(x.v||0)/max*100));
      return '<div class="lv-bar" title="'+esc(ymLabel(x.k)+': '+money(x.v))+'"><i style="height:'+h+'%"></i><span>'+esc(ymLabel(x.k).split(' ')[0])+'</span></div>'; }).join('')+'</div>';
  }
  function tile(label, value, sub, type){ return '<div class="card tile"><div class="lbl">'+label+(type?chip(type):'')+'</div><div class="val">'+value+'</div><div class="chg">'+sub+'</div></div>'; }
  L.render = function(cin, brief){
    var store=load(cin), have=['sales','recv','pay','exp','cash'].filter(function(m){ return m==='sales'||m==='exp'||m==='cash' ? store[m]&&Object.keys(store[m].months||{}).length : !!store[m]; });
    var h='<div class="sec" id="live-'+esc(cin)+'"><h2>Live business data <span class="small" style="font-family:var(--sans)">· private · on this device</span></h2>'
      +'<div class="lv-privacy"><b>Your files never leave this browser.</b> They are read here, turned into summary figures, and only those summaries are kept on this device. ipowork never receives them. <a href="#" data-lv="export" data-cin="'+esc(cin)+'">Download my summaries</a> · <a href="#" data-lv="clear" data-cin="'+esc(cin)+'">Delete everything</a></div>';
    if(have.length){
      var res=L.compute(store, brief), K=res.K;
      var prev=store.history&&store.history.length>1?store.history[store.history.length-2]:null, ch=changes(K, prev);
      h+='<div class="grid g4" style="margin-top:14px">'
        +(K.lastSales!==undefined?tile('SALES · '+esc(ymLabel(K.lastMonth).toUpperCase()), money(K.lastSales), K.vsAvg!==undefined?pct(K.vsAvg,1)+' vs previous 3-month average':'latest month uploaded','ACTUAL'):'')
        +(K.runRate?tile('ANNUAL RUN-RATE', money(K.runRate), K.vsFiled!==undefined?pct(K.vsFiled,1)+' vs '+esc(brief.latestFy)+' filed revenue':'last 3 months × 4','ESTIMATED'):'')
        +(K.dso?tile('RECEIVABLE DAYS', K.dso+' days', K.dsoFiled?'vs '+K.dsoFiled+' days in '+esc(K.dsoFiledFy)+' accounts':'receivables ÷ last 3 months\u2019 daily sales','DERIVED'):(K.recvTotal!==undefined?tile('RECEIVABLES', money(K.recvTotal), 'as of '+esc(K.recvAsOf),'ACTUAL'):''))
        +(K.runway!==undefined?tile('CASH RUNWAY', (Math.round(K.runway*10)/10)+' months', 'cash '+money(K.cash)+' ÷ last 3 months\u2019 net outflow','ESTIMATED'):(K.cash!==undefined?tile('CASH & BANK', money(K.cash), K.burn!==null&&K.burn<=0?'cash is growing':'as of '+esc(ymLabel(K.cashMonth)),'ACTUAL'):''))
        +(K.opMargin!==undefined?tile('OPERATING MARGIN (EST.)', pct(K.opMargin), K.marginFiled!==undefined?'vs '+K.marginFiled+'% EBITDA margin in '+esc(brief.latestFy):'last 3 months · ignores stock change','ESTIMATED'):'')
        +(K.top1!==undefined&&K.top1!==null?tile('LARGEST CUSTOMER', pct(K.top1), 'top 5 = '+pct(K.top5)+' of 12-month sales','DERIVED'):'')
        +(K.recv90!==undefined&&K.recv90!==null?tile('90+ DAYS OVERDUE', pct(K.recv90), money(K.recvBuckets.d90p)+' of '+money(K.recvTotal),'DERIVED'):'')
        +(K.dpo?tile('PAYABLE DAYS', K.dpo+' days', 'payables ÷ last 3 months\u2019 material purchases','DERIVED'):'')
        +'</div>';
      h+='<h3 class="lv-h">Business alerts</h3><div class="grid g2">'+res.alerts.map(function(a){ return '<div class="card"><span class="lv '+a.level+'">'+({normal:'● NORMAL',watch:'▲ WATCH',critical:'■ NEEDS ATTENTION'}[a.level])+'</span><h3 style="margin:8px 0 4px;font-size:15px">'+esc(a.area)+'</h3><p style="margin:0;font-size:13.5px;line-height:1.5">'+esc(a.what)+'</p>'
        +(a.why?'<p style="margin:6px 0 0;font-size:13px;color:var(--ink2)"><b>Why it matters:</b> '+esc(a.why)+'</p><p style="margin:4px 0 0;font-size:13px;color:var(--ink2)"><b>Suggested management review:</b> '+esc(a.look)+'</p>':'')+'</div>'; }).join('')+'</div>';
      if(ch.length) h+='<h3 class="lv-h">What changed since your last upload</h3><div class="grid" style="gap:8px">'+ch.map(function(c){ return '<div class="change '+c.dir+'"><div class="t"><span class="ic">'+(c.dir==='up'?'▲ BETTER':'▼ WORSE')+'</span><b>'+esc(c.title)+'</b></div></div>'; }).join('')+'</div>';
      h+='<div class="grid g2" style="margin-top:14px">'
        +(K.salesMonths?'<div class="card"><div class="lbl" style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--muted)">MONTHLY SALES'+chip('ACTUAL')+'</div>'+bars(K.salesMonths)+'</div>':'')
        +(K.recvBuckets?'<div class="card"><div class="lbl" style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--muted)">RECEIVABLES AGEING · AS OF '+esc(K.recvAsOf)+chip('ACTUAL')+'</div>'+ageing(K.recvBuckets,K.recvTotal)+'</div>':'')
        +(K.topCustomers&&K.topCustomers.length?'<div class="card"><div class="lbl" style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--muted)">TOP CUSTOMERS · LAST 12 MONTHS'+chip('DERIVED')+'</div>'+K.topCustomers.map(function(c){ return '<div class="lv-row"><span>'+esc(c.name)+'</span><b>'+pct(c.share)+'</b></div>'; }).join('')+'</div>':'')
        +(K.cashSeries?'<div class="card"><div class="lbl" style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--muted)">CASH & BANK · MONTH-END'+chip('ACTUAL')+'</div>'+bars(K.cashSeries)+'</div>':'')
        +'</div>';
    } else {
      h+='<p class="sub" style="margin-top:12px">Upload your monthly exports to see live sales, customer concentration, receivable ageing, cash runway and business alerts — and how today compares with your last filed accounts.</p>';
    }
    h+='<h3 class="lv-h">Upload monthly data</h3><div class="grid g3">'+Object.keys(MODS).map(function(m){
      var M=MODS[m], on=have.indexOf(m)>-1;
      return '<div class="card lv-up"><b>'+esc(M.title)+'</b>'+(on?' <span class="lv normal" style="margin-left:6px">✓ LOADED</span>':'')+'<p>'+esc(M.hint)+'</p>'
        +'<label class="btn o lv-file">Choose Excel or CSV<input type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt" data-lv="file" data-mod="'+m+'" data-cin="'+esc(cin)+'" hidden></label> '
        +'<a href="#" class="small" data-lv="tpl" data-mod="'+m+'">Template</a><div class="lv-msg small" id="lvmsg-'+m+'-'+esc(cin)+'" role="status"></div></div>'; }).join('')+'</div>'
      +'<p class="small" style="margin-top:10px">Tip: in Tally, export Sales Register, Bills Receivable and Bills Payable as Excel. Upload each month; months you upload again replace the earlier figures. Receivables and payables are aged as of today.</p></div>';
    return h;
  };
  function ageing(b,total){
    var rows=[['Not yet due',b.notDue],['1–30 days overdue',b.d30],['31–60',b.d60],['61–90',b.d90],['90+ days overdue',b.d90p]];
    return rows.map(function(r,i){ var p=total?r[1]/total*100:0; return '<div class="lv-age"><span>'+r[0]+'</span><i><em style="width:'+Math.max(0,Math.min(100,p))+'%;background:'+(i>=4?'var(--down)':i>=2?'var(--mix)':'var(--brand2)')+'"></em></i><b>'+money(r[1])+'</b></div>'; }).join('');
  }

  /* ---------------- events (delegated; call once) ---------------- */
  var bound=false;
  L.bind = function(getBrief, rerender){
    if(bound) return; bound=true;
    document.addEventListener('change', async function(e){
      var inp=e.target; if(!inp.matches||!inp.matches('[data-lv="file"]')||!inp.files||!inp.files[0]) return;
      var mod=inp.getAttribute('data-mod'), cin=inp.getAttribute('data-cin'), msg=document.getElementById('lvmsg-'+mod+'-'+cin), f=inp.files[0];
      msg.className='lv-msg small'; msg.textContent='Reading '+f.name+' in your browser…';
      try{
        var grid=await readFile(f); var mapped=mapRows(grid, mod);
        if(mapped.error){ msg.className='lv-msg small err'; msg.textContent=mapped.error; inp.value=''; return; }
        var sm=summarise(mod, mapped.rows, new Date());
        var store=load(cin); merge(store, mod, sm.data);
        var K=L.compute(store, getBrief(cin)).K; store.history=(store.history||[]).concat([snapshot(K)]).slice(-24); store.updatedAt=new Date().toISOString();
        if(!save(cin, store)){ msg.className='lv-msg small err'; msg.textContent='This browser\u2019s storage is full — delete old data and try again.'; return; }
        rerender(cin, mod, (mapped.rows.length-sm.bad)+' row(s) read'+(sm.bad?', '+sm.bad+' skipped (no date or amount)':'')+'. File not uploaded anywhere.');
      }catch(err){ msg.className='lv-msg small err'; msg.textContent=err.message||'Could not read that file.'; }
      inp.value='';
    });
    document.addEventListener('click', function(e){
      var a=e.target.closest('[data-lv]'); if(!a||a.getAttribute('data-lv')==='file') return; e.preventDefault();
      var act=a.getAttribute('data-lv'), cin=a.getAttribute('data-cin');
      if(act==='tpl'){ var m=a.getAttribute('data-mod'); dl('ipowork_'+m+'_template.csv', MODS[m].template, 'text/csv'); }
      if(act==='export'){ dl('ipowork_live_summaries_'+cin+'.json', JSON.stringify(load(cin),null,2), 'application/json'); }
      if(act==='clear'){ if(confirm('Delete all uploaded summaries for this company from this device?')){ localStorage.removeItem(KEY(cin)); rerender(cin); } }
    });
  };
  function dl(name, text, type){ var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); },500); }
  L._test = {dt:dt, amt:amt, mapRows:mapRows, summarise:summarise, merge:merge, csvRows:csvRows};
})();
