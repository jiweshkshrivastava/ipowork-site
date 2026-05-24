/* ipowork Worker v11.0 — single full_paid call, exact Probe42 field paths */

/* ── Probe42 via Supabase Edge Function proxy ── */
async function probe42Fetch(endpoint, env) {
  const SUPA_URL = env.SUPABASE_URL || 'https://esqlfsjhekdspycfgnoz.supabase.co';
  const SUPA_KEY = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || '';
  const ctrl = new AbortController();
  const tid = setTimeout(()=>ctrl.abort(), 9000);
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/probe42-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ endpoint, api_key: env.PROBE42_KEY||'' }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if(!r.ok) throw new Error(`Proxy ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tid); }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // Haiku: 4x faster, responds in ~3s
const SUPABASE_URL = 'https://esqlfsjhekdspycfgnoz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcWxmc2poZWtkc3B5Y2Znbm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MzE4ODUsImV4cCI6MjA5MDMwNzg4NX0.nuJCy5xn0K6IpWptphUHv8iXK5xxPm_Eqx-1XzgVHFc';

/* ═══════════════════════════════════════════════════════════════
   AIRA VALUATION ENGINE — Worker functions
   Doc-based (₹2,999) + Intelligence/Probe42 (₹7,999)
   Methodology: DCF + Comparable + Asset-based
   Law: SEBI ICDR 2018, Companies Act 2013, IndAS 113, FEMA
   ═══════════════════════════════════════════════════════════════ */

async function valuationDoc(body, key) {
  const { company_name='', cin='', sector='Manufacturing', exchange='NSE Emerge (SME)',
          documents='', revenue='', pat='', ebitda='', net_worth='', total_assets='' } = body;
  if(!company_name) return jErr('Company name required', 400);

  const today = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});

  const prompt = `TODAY: ${today}. Use this exact date as Valuation Date everywhere.

You are a SEBI-registered Category-I Merchant Banker. Prepare a COMPLETE valuation report for IPO filing.

Company: ${company_name} | CIN: ${cin||'N/A'} | Sector: ${sector} | Exchange: ${exchange}
Revenue: ${revenue||'estimate from docs'} | PAT: ${pat||'estimate'} | EBITDA: ${ebitda||'estimate'}
Net Worth: ${net_worth||'estimate'} | Total Assets: ${total_assets||'estimate'}

Documents: ${documents.substring(0,4000)}

STEP 1 — Return ONLY this JSON block first:
---VALUATION_JSON_START---
{
  "revenue_cr": <number>,
  "revenue_3yr_cagr": <number>,
  "pat_cr": <number>,
  "ebitda_cr": <number>,
  "ebitda_margin_pct": <number>,
  "pat_margin_pct": <number>,
  "net_worth_cr": <number>,
  "total_assets_cr": <number>,
  "total_debt_cr": <number>,
  "debt_equity": <number>,
  "current_ratio": <number>,
  "roe": <number>,
  "roce": <number>,
  "interest_coverage": <number>,
  "wacc": <number>,
  "wacc_basis": "<Rf+Beta*ERP basis string>",
  "terminal_growth_rate": <number>,
  "projection_yr1_rev": <number>,
  "projection_yr2_rev": <number>,
  "projection_yr3_rev": <number>,
  "projection_yr4_rev": <number>,
  "projection_yr5_rev": <number>,
  "projection_yr1_ebitda": <number>,
  "projection_yr2_ebitda": <number>,
  "projection_yr3_ebitda": <number>,
  "projection_yr4_ebitda": <number>,
  "projection_yr5_ebitda": <number>,
  "projection_yr1_pat": <number>,
  "projection_yr2_pat": <number>,
  "projection_yr3_pat": <number>,
  "projection_yr4_pat": <number>,
  "projection_yr5_pat": <number>,
  "projection_yr1_fcff": <number>,
  "projection_yr2_fcff": <number>,
  "projection_yr3_fcff": <number>,
  "projection_yr4_fcff": <number>,
  "projection_yr5_fcff": <number>,
  "terminal_value": <number>,
  "pv_fcff_sum": <number>,
  "enterprise_value_dcf": <number>,
  "equity_value_dcf": <number>,
  "val_dcf_cr": <number>,
  "val_pe_cr": <number>,
  "val_ev_cr": <number>,
  "val_nav_cr": <number>,
  "weight_dcf": 0.35,
  "weight_pe": 0.30,
  "weight_ev": 0.25,
  "weight_nav": 0.10,
  "weighted_val_cr": <number>,
  "sme_discount": <15 to 25>,
  "val_conservative_cr": <number>,
  "val_base_cr": <number>,
  "val_optimistic_cr": <number>,
  "price_band_low": <number>,
  "price_band_high": <number>,
  "face_value": 10,
  "primary_method": "<DCF or P/E or EV/EBITDA>",
  "sector_pe_avg": <number>,
  "sector_ev_avg": <number>,
  "pe_low": <number>,
  "pe_mid": <number>,
  "pe_high": <number>,
  "ev_ebitda_low": <number>,
  "ev_ebitda_mid": <number>,
  "ev_ebitda_high": <number>,
  "peer1_name": "<listed NSE/BSE peer>",
  "peer1_rev": <number>,
  "peer1_pat": <number>,
  "peer1_ebitda_margin": <number>,
  "peer1_pe": <number>,
  "peer1_ev": <number>,
  "peer1_mc": <number>,
  "peer2_name": "<listed peer>",
  "peer2_rev": <number>,
  "peer2_pat": <number>,
  "peer2_ebitda_margin": <number>,
  "peer2_pe": <number>,
  "peer2_ev": <number>,
  "peer2_mc": <number>,
  "peer3_name": "<listed peer>",
  "peer3_rev": <number>,
  "peer3_pat": <number>,
  "peer3_ebitda_margin": <number>,
  "peer3_pe": <number>,
  "peer3_ev": <number>,
  "peer3_mc": <number>,
  "key_driver1": "<specific driver>",
  "key_driver2": "<specific driver>",
  "key_driver3": "<specific driver>",
  "key_risk1": "<specific risk with discount applied>",
  "key_risk2": "<specific risk>",
  "key_risk3": "<specific risk>"
}
---VALUATION_JSON_END---

STEP 2 — Full valuation report (complete all 10 sections):

# Valuation Report — ${company_name}
## Prepared per SEBI ICDR 2018 Reg 26(4) | ICAI Valuation Standards 2018 | Valuation Date: ${today}

## 1. Executive Summary
| Parameter | Value |
|-----------|-------|
| Company | ${company_name} |
| CIN | ${cin||'N/A'} |
| Sector | ${sector} |
| Exchange | ${exchange} |
| Valuation Date | ${today} |
| Primary Method | [state method] |
| Base Case Valuation | ₹[X] Cr |
| IPO Price Band | ₹[Low] — ₹[High] per share (FV ₹10) |

[2-sentence business summary and IPO suitability]

## 2. Business Overview
[3-4 sentences: business activity, years of operation, products/services, end markets, geographic presence, workforce, competitive position in ${sector}]

Key highlights:
- Revenue model and customer mix
- Operational capacity and certifications
- Market position and order book
- Recent developments (last 12 months)

## 3. Historical Financial Analysis
| Metric | FY22E | FY23E | FY24 | YoY Growth |
|--------|-------|-------|------|------------|
| Revenue (₹Cr) | [X] | [X] | [X] | [X]% |
| EBITDA (₹Cr) | [X] | [X] | [X] | [X]% |
| EBITDA Margin | [X]% | [X]% | [X]% | — |
| PAT (₹Cr) | [X] | [X] | [X] | [X]% |
| Net Worth (₹Cr) | [X] | [X] | [X] | — |
| D/E Ratio | [X] | [X] | [X] | — |

Key ratio analysis: ROE [X]%, ROCE [X]%, Current Ratio [X]x, Interest Coverage [X]x vs sector benchmarks.

## 4. Valuation Methodology

### Method 1: P/E Comparable
Sector avg P/E: [X]x. Applied [X]x (after [X]% SME discount). PAT ₹[X]Cr × [X]x = **₹[X] Cr**

### Method 2: EV/EBITDA
Sector avg EV/EBITDA: [X]x. Applied [X]x. EBITDA ₹[X]Cr × [X]x − Net Debt ₹[X]Cr = **₹[X] Cr**

### Method 3: DCF (5-Year)
WACC: [X]% (Rf [X]% + β[X] × ERP[X]%). Terminal growth: [X]%.
PV of FCFF ₹[X]Cr + PV of TV ₹[X]Cr = EV ₹[X]Cr − Net Debt ₹[X]Cr = **₹[X] Cr**

### Method 4: NAV
Adjusted Net Worth ₹[X]Cr × P/B [X]x = **₹[X] Cr**

### Reconciliation
| Method | Value (₹Cr) | Weight | Weighted (₹Cr) |
|--------|------------|--------|----------------|
| DCF | [X] | 35% | [X] |
| P/E | [X] | 30% | [X] |
| EV/EBITDA | [X] | 25% | [X] |
| NAV | [X] | 10% | [X] |
| **Weighted** | — | **100%** | **[X]** |
| SME Discount ([X]%) | — | — | ([X]) |
| **Final Base Case** | — | — | **₹[X] Cr** |

## 5. IPO Price Band Recommendation
Price band ₹[Low] — ₹[High] per share (FV ₹10). Basis: [explanation].
Implied P/E: [X]x — [X]x. Premium over book value: [X]%.

## 6. Key Value Drivers
1. **[Driver]:** [2 sentences with specific data]
2. **[Driver]:** [2 sentences]
3. **[Driver]:** [2 sentences]

## 7. Risk Factors & Discounts
| Risk | Discount | Mitigant |
|------|---------|---------|
| SME Illiquidity | 15-20% | Book-building demand |
| Promoter concentration | 5-8% | Lock-in compliance |
| [Sector risk] | 3-5% | [Mitigant] |

## 8. Regulatory Compliance
- SEBI ICDR 2018 Reg 26(4): Multiple methods applied ✓
- ICAI Valuation Standards 2018 (IVS 105): Complied ✓
- IndAS 113: Market participant assumptions ✓
- Companies Act 2013 Sec 62: Pricing basis documented ✓

## 9. Assumptions & Limitations
[Key assumptions made, data gaps, limitations of this indicative valuation]

## 10. Disclaimer
Indicative valuation for advisory purposes only. Not a SEBI-registered fairness opinion. Final IPO pricing by SEBI-registered Category-I Merchant Banker via book-building. Confidential.`;

  let report = '';
  try { report = await callClaude(key, prompt, 8000); } catch(e) { return jErr('Valuation AI error: '+e.message, 500); }

  let vdata = {};
  const jm = report.match(/---VALUATION_JSON_START---([\s\S]*?)---VALUATION_JSON_END---/);
  if(jm){ try{ vdata = JSON.parse(jm[1].trim()); }catch(e){} }
  const cleanReport = report.replace(/---VALUATION_JSON_START---[\s\S]*?---VALUATION_JSON_END---/,'').trim();

  try{ await sbInsert('reports',{cin:cin||null,company_name,sector,exchange,tier:'valdoc',score:0,report_text:cleanReport.slice(0,3500),source:'valuation_doc'}); }catch(e){}
  return jOK({ ...vdata, _report: cleanReport, company_name, cin, sector, exchange, _source:'document_based', _type:'valuation' });
}

async function valuationIntel({cin='',sector='Manufacturing',exchange='NSE Emerge (SME)'},key,probeKey) {
  if(!key) return jErr('ANTHROPIC_API_KEY not set',500);
  if(!cin) return jErr('CIN required',400);

  // Fetch Probe42 with short timeout
  const url=`https://api.probe42.in/probe_pro/companies/${encodeURIComponent(cin)}/comprehensive-details`;
  let flat={}, probeOk=false;
  if(probeKey){
    try{
      const ctrl=new AbortController();
      const tid=setTimeout(()=>ctrl.abort(),7000);
      const r=await fetch(url,{headers:{'x-api-key':probeKey,'Accept':'application/json','x-api-version':'1.3'},signal:ctrl.signal});
      clearTimeout(tid);
      if(r.ok){const raw=await r.json();flat=extractProbe42(raw.data||raw,cin);probeOk=!!(flat.company_name&&flat.company_name!=='NOT FOUND');}
    }catch(e){}
  }

  const f=flat.financials||{};
  const cname=flat.company_name||cin;
  function fC(v){if(!v||isNaN(v))return'N/A';const n=Number(v);return n>=10000000?'₹'+(n/10000000).toFixed(1)+' Cr':n>=100000?'₹'+(n/100000).toFixed(1)+' L':'₹'+n.toFixed(0);}
  function fP(v){return v!=null&&!isNaN(v)?parseFloat(v).toFixed(1)+'%':'N/A';}

  const dataSection=probeOk
    ?`CIN:${cin} | ${cname} | ${sector} | ${exchange}
Revenue:${fC(f.revenue_fy24)} | PAT:${fC(f.pat_fy24)} | EBITDA:${fP(f.ebitda_margin)}
NetWorth:${fC(f.net_worth)} | D/E:${f.debt_equity_ratio||'N/A'}x | ROE:${fP(f.roe)}
Assets:${fC(f.total_assets)} | Debt:${fC(f.total_debt)} | Paid-up:${fC(flat.paid_up_capital)}`
    :`CIN:${cin} | Sector:${sector} | Exchange:${exchange} | Use AI knowledge for financials`;

  // Short focused prompt — must complete within 15s
  const prompt=`You are a SEBI Merchant Banker. Prepare IPO valuation for this company.
${dataSection}

FIRST output ONLY this JSON block (no other text before it):
---VALUATION_JSON_START---
{"val_conservative_cr":0,"val_base_cr":0,"val_optimistic_cr":0,"revenue_cr":0,"pat_cr":0,"ebitda_cr":0,"ebitda_margin_pct":0,"net_worth_cr":0,"roe":0,"primary_method":"P/E Comparable","sector_pe_avg":0,"sector_ev_avg":0,"sme_discount":15,"wacc":13,"price_band_low":0,"price_band_high":0,"peer1_name":"Peer1","peer1_pe":0,"peer1_ev":0,"peer1_mc":0,"peer2_name":"Peer2","peer2_pe":0,"peer2_ev":0,"peer2_mc":0,"key_driver1":"Growth","key_driver2":"Margins","key_risk1":"Sector risk","key_risk2":"Execution risk","company_name":"${cname}"}
---VALUATION_JSON_END---

Then write 400 words covering:
## Valuation Summary (P/E & EV/EBITDA with 2-3 listed peers)
## Price Band: ₹X–₹Y per share
## Key Drivers & Risks
## Conclusion`;

  let report;
  try{
    report=await callClaude(key,prompt,1500,false);
  }catch(e){return jErr('Claude error: '+e.message,500);}

  let vdata={};
  const jm=report.match(/---VALUATION_JSON_START---([\s\S]*?)---VALUATION_JSON_END---/);
  if(jm){try{vdata=JSON.parse(jm[1].trim());}catch(e){}}
  const cleanReport=report.replace(/---VALUATION_JSON_START---[\s\S]*?---VALUATION_JSON_END---/g,'').trim();

  try{await sbInsert('reports',{cin,company_name:vdata.company_name||cname,sector,exchange,
    tier:'valintel',score:0,report_text:cleanReport.slice(0,8000),
    source:probeOk?'probe42_verified':'ai_valuation'});}catch(e){}

  return jOK({...vdata,_report:cleanReport,
    company_name:vdata.company_name||cname,cin,sector,exchange,
    _source:probeOk?'probe42_verified':'ai_only',_type:'valuation'});
}


async function probe42Raw(cin,probeKey,env) {
  const endpoint = `companies/${encodeURIComponent(cin)}/comprehensive-details`;
  let raw = null;
  const supaKey = (env||{}).SUPABASE_ANON_KEY || (env||{}).SUPABASE_KEY || '';

  if(supaKey) {
    // Use Supabase proxy if key is configured
    try { raw = await probe42Fetch(endpoint, env||{}); } catch(e1) {}
  }

  if(!raw || raw?.Message || raw?.message) {
    // Direct call to Probe42
    if(!probeKey) return jErr('PROBE42_KEY not set',503);
    try {
      const ctrl=new AbortController();
      const tid=setTimeout(()=>ctrl.abort(),9000);
      const probeUrl = `https://api.probe42.in/probe_pro/companies/${encodeURIComponent(cin)}/comprehensive-details`;
      const r=await fetch(probeUrl,{
        headers:{'x-api-key':probeKey,'Accept':'application/json','x-api-version':'1.3'},
        signal:ctrl.signal
      });
      clearTimeout(tid);
      const text=await r.text();
      try{raw=JSON.parse(text);}catch(e){}
    } catch(e2) {
      return jErr('Probe42 fetch failed: '+e2.message, 500);
    }
  }
  try {
    const data = raw?.data||raw||{};
    const flat = extractProbe42(data, cin);
    // Add diagnostic info if data came back empty
    if(!flat.company_name || flat.company_name==='NOT FOUND') {
      flat._debug = {
        raw_keys: Object.keys(raw||{}).slice(0,10),
        data_keys: Object.keys(data||{}).slice(0,10),
        has_company: !!(data.company),
        cin_searched: cin,
        message: (raw||{}).Message || (raw||{}).message || (data||{}).Message || '',
        status: (raw||{}).status || (raw||{}).statusCode || '',
        worker_ver: 'v10.20'
      };
    }
    return jOK(flat);
  } catch(e) {
    return jErr('Probe42 parse failed: '+e.message, 500);
  }
}

/* ── COMPANY SEARCH ── */
async function companySearch(query,key) {
  if(!query||query.length<3) return jOK({results:[]});
  try{
    const txt=await callClaude(key,`List up to 6 real Indian companies or LLPs whose registered name contains "${query}". Include both companies (CIN format: U12345MH2020PTC123456) and LLPs (LLPIN format: AAA-1234). Return ONLY JSON array: [{"cin":"CIN or LLPIN or UNKNOWN","name":"EXACT REGISTERED NAME","type":"company or llp"}]`,400);
    const m=txt.match(/\[[\s\S]*?\]/);
    if(m){try{return jOK({results:JSON.parse(m[0]).slice(0,6)});}catch(e){}}
  }catch(e){}
  return jOK({results:[]});
}

/* ── FREE TIER ── */
async function freeAIRA({cin,company_name='',sector='Manufacturing',exchange='NSE Emerge (SME)'},key) {
  cin = String(cin||'').trim().toUpperCase().replace(/\s+/g,'');
  if(!cin) return jErr('CIN or LLPIN required',400);
  if(!key) return jErr('ANTHROPIC_API_KEY not set in Worker secrets',500);
  const cinU=cin.toUpperCase();
  const states={MH:'Maharashtra',DL:'Delhi',KA:'Karnataka',TN:'Tamil Nadu',GJ:'Gujarat',WB:'West Bengal',UP:'Uttar Pradesh',RJ:'Rajasthan',AP:'Andhra Pradesh',TS:'Telangana',HR:'Haryana',PB:'Punjab',MP:'Madhya Pradesh',OR:'Odisha',KL:'Kerala',BR:'Bihar'};
  const state=states[cinU.substring(7,9)]||cinU.substring(7,9);
  const year=cinU.substring(9,13);
  const isListed=cinU[0]==='L';

  const prompt=`You are the ipowork AIRA Engine with web search. Search for any recent news or regulatory actions on this company, then score it for IPO readiness.
${company_name?`Company: "${company_name}"`:`Identify company for CIN: ${cin}`} | CIN: ${cin} | State: ${state} | Year: ${year} | ${isListed?'Listed':'Unlisted'} | Sector: ${sector} | Exchange: ${exchange}

Use your MCA/Screener knowledge. Never fabricate numbers. Say "not available" for unknown data.

SEBI rules: Private Ltd must convert (CA2013 §18). B/S ≤18mo (ICDR Reg 26(1)(f)). ≥2 IDs (ICDR Reg 26(6)). Woman director (CA2013 §149(1)). SME: ₹1-25Cr paid-up, NTA ≥₹3Cr.

Output EXACTLY:
RESEARCH_JSON_START
{"company_name":"${company_name||'ACTUAL NAME'}","status":"Active","date_of_incorporation":"date or null","company_type":"Private/Public Limited","paid_up_capital":"₹X Cr or null","authorised_capital":"₹X Cr or null","registered_state":"${state}","roc_code":"null","last_agm_date":"null","last_balance_sheet_date":"null","registered_address":"null","directors":[{"name":"name","din":"null","designation":"role","status":"Active"}],"charges":[],"financials":{"revenue_fy24":"₹X Cr or null","revenue_fy23":"null","pat_fy24":"null","ebitda_margin":"null","net_worth":"null","debt_equity_ratio":"null","roe":"null","auditor":"null","fy_year":"FY24"},"compliance":{"gst_status":"Unknown","roc_filing_status":"Unknown","any_notices":"None"},"legal":{"litigation_count":0,"material_litigation":"None"},"promoters":{"promoter_holding_pct":"null","pledge_pct":"0%","promoter_names":[]},"business":{"key_products_services":"fill","industry_position":"fill"},"data_quality":{"data_confidence":"Low","data_sources":["Claude training data"],"notes":"Free tier only"}}
RESEARCH_JSON_END

REPORT_START
AIRA Score: [0-100]
ELIGIBILITY VERDICT: [one sentence — which SEBI threshold and why met/not]

## Financial Analysis
[2-3 sentences with actual figures or honest "not publicly available".]

## Governance
[Directors by name. ID count vs requirement. Woman director. Committees.]

## Compliance
[B/S staleness. ROC filings. GST/TDS.]

## Promoter & Legal
[Holding %. Pledge. Litigation.]

## Critical Gaps
1. [gap] — [SEBI/CA2013 exact reg] — [CRITICAL/HIGH/MEDIUM] — Fix: [action, timeline, ₹cost]
2. [gap] — [reg] — [priority] — Fix: [detail]
3. [gap] — [reg] — [priority] — Fix: [detail]
4. [gap] — [reg] — [priority] — Fix: [detail]
5. [gap] — [reg] — [priority] — Fix: [detail]

## Action Plan
1. IMMEDIATE (0-30d, ₹X L): [action]
2. SHORT-TERM (30-90d, ₹X L): [action]
3. MEDIUM-TERM (90-180d): [action]
4. PRE-FILING: [action]
5. MB ENGAGEMENT: [criteria]

DIMENSION SCORES:
---JSON---
{"financial":N,"governance":N,"compliance":N,"promoter":N,"legal":N,"readiness":N}
---END---

## Score Explanation
[3 sentences: positives with numbers, negatives with gaps, top fix with expected improvement.]
REPORT_END`;

  let fullText='';
  try{fullText=await callClaude(key,prompt,3500);}catch(e){return jErr('Claude error: '+e.message,500);}

  let research={company_name:company_name||cin,registered_state:state,data_quality:{data_confidence:'Low',data_sources:['Claude training data'],notes:'Free tier'}};
  const rm=fullText.match(/RESEARCH_JSON_START\s*([\s\S]*?)\s*RESEARCH_JSON_END/);
  if(rm){try{research=JSON.parse(rm[1].trim());if(company_name)research.company_name=company_name;}catch(e){}}

  let report='';
  const pm=fullText.match(/REPORT_START\s*([\s\S]*?)\s*REPORT_END/);
  if(pm)report=pm[1].trim();
  else report=fullText.replace(/RESEARCH_JSON_START[\s\S]*?RESEARCH_JSON_END/g,'').trim();

  const fin=research.financials||{};
  /* Log to Supabase (non-blocking) */
  const freeDims = {};
  try {
    const jm2 = report.match(/---JSON---\s*([\s\S]*?)---END---/);
    if (jm2) Object.assign(freeDims, JSON.parse(jm2[1].trim()));
  } catch(e) {}
  const freeScoreM = report.match(/AIRA Score:\s*(\d+)/i);
  await sbInsert('reports', {
    cin,
    company_name: research.company_name || company_name || null,
    sector,
    exchange,
    tier: 'free',
    score: freeScoreM ? parseInt(freeScoreM[1]) : null,
    financial_score: freeDims.financial || null,
    governance_score: freeDims.governance || null,
    compliance_score: freeDims.compliance || null,
    promoter_score: freeDims.promoter || null,
    legal_score: freeDims.legal || null,
    readiness_score: freeDims.readiness || null,
    report_text: report.slice(0, 4000),
    source: 'claude_knowledge',
  });

  return jOK({cin,sector,exchange,research,report,has_financials:!!(fin.revenue_fy24||fin.pat_fy24||fin.net_worth)});
}

/* ── FULL PAID: Probe42 fetch + Claude score in ONE call ── */
/* ── Extract Probe42 fields ── */
function extractProbe42(raw, cin) {
  // Probe42 v1.3 structure: raw = { company:{...}, financials:[...], authorized_signatories:[...], ... }
  const d = raw.company || raw; // company details nested under 'company' key
  const finArr = Array.isArray(raw.financials) ? raw.financials : [];
  const f0 = finArr[0] || {}; // most recent year
  const f1 = finArr[1] || {}; // prior year (FY23)
  const f2 = finArr[2] || {}; // two years ago (FY22)
  const ratios = f0.ratios || {};
  const pnl = f0.pnl || {};
  const bal = f0.bs || {};
  const cf = f0.cash_flow || {};
  const f = {...ratios, ...pnl, ...bal, ...cf};
  // Prior year extractors
  function toCrY(yr,field){
    // NO fallback - return null if field not found for that year
    const p=yr.pnl||{},li=p.lineItems||{},rb=p.revenue_breakup||{};
    const val = li[field]||rb[field]||null;
    return val ? toCr(val) : null;
  }
  const c = d.compliance || d.compliance_data || {};
  const dirs = Array.isArray(raw.authorized_signatories) ? raw.authorized_signatories :
               Array.isArray(d.directors) ? d.directors : [];
  // Normalize director fields to match expected format
  const normalizedDirs = dirs.map(function(dir) {
    return {
      name: dir.name||'',
      din: dir.din||'',
      designation: dir.designation||'Director',
      gender: dir.gender||'',
      cessation: dir.date_of_cessation||null,
      appointed: dir.date_of_appointment||''
    };
  });
  const chargeRaw = Array.isArray(raw.open_charges) ? raw.open_charges :
                   Array.isArray(raw.charges) ? raw.charges :
                   Array.isArray(d.charges) ? d.charges :
                   Array.isArray(d.open_charges) ? d.open_charges : [];
  const charges = chargeRaw.map(function(c){
    return {
      charge_holder: c.charge_holder||c.holder||c.lender_name||c.bank_name||c.creditor||'N/A',
      amount: c.amount||c.charge_amount||null,
      status: c.status||c.charge_status||(c.date_of_satisfaction?'Satisfied':'Open'),
      date_of_creation: c.date_of_creation||c.created_date||c.date||null,
      date_of_satisfaction: c.date_of_satisfaction||null
    };
  });
  const peers = [];
  const cr = Array.isArray(d.credit_ratings) ? d.credit_ratings : [];

  function ga(...args){for(const a of args){if(a!=null&&!isNaN(parseFloat(a)))return parseFloat(a);}return null;}
  // EXACT Probe42 v1.3 field paths confirmed from API
  const li = pnl.lineItems || {};       // revenue, PAT etc
  const rb = pnl.revenue_breakup || {}; // revenue from operations
  const bsA = bal.assets || {};         // assets
  const bsL = bal.liabilities || {};    // liabilities  
  const bsS = bal.subTotals || {};      // totals
  
  // Convert rupees to Crore (Probe42 returns absolute rupees)
  function toCr(v){if(!v||isNaN(v))return null;return Math.abs(parseFloat(v))/10000000;}
  
  const fin = {
    revenue_fy24:   toCr(li.net_revenue||rb.revenue_from_operations),
    pat_fy24:       toCr(li.profit_after_tax),
    revenue_fy23:   toCrY(f1,'net_revenue'),
    pat_fy23:       toCrY(f1,'profit_after_tax'),
    revenue_fy22:   toCrY(f2,'net_revenue'),
    pat_fy22:       toCrY(f2,'profit_after_tax'),
    fy24_year:      (function(){var y=f0.year||f0.financial_year||'';var s=String(y).replace(/[^0-9]/g,'');if(!s)return 'FY24';var n=parseInt(s.length>=4?s.slice(-2):s);return(n>=18&&n<=30)?'FY'+n:'FY24';})(),
    fy23_year:      (function(){var y=f1.year||f1.financial_year||'';var s=String(y).replace(/[^0-9]/g,'');if(!s)return 'FY23';var n=parseInt(s.length>=4?s.slice(-2):s);return(n>=18&&n<=30)?'FY'+n:'FY23';})(),
    fy22_year:      (function(){var y=f2.year||f2.financial_year||'';var s=String(y).replace(/[^0-9]/g,'');if(!s)return 'FY22';var n=parseInt(s.length>=4?s.slice(-2):s);return(n>=18&&n<=30)?'FY'+n:'FY22';})(),
    ebitda_margin:  ga(ratios.ebitda_margin),
    net_worth:      toCr(bsS.total_equity||bsL.share_capital),
    total_assets:   toCr(bsA.given_assets_total||bsS.total_current_assets),
    total_debt:     toCr(bsS.total_debt||bsL.short_term_borrowings),
    debt_equity_ratio: ga(ratios.debt_by_equity),
    roe:            ga(ratios.return_on_equity),
    roce:           ga(ratios.return_on_capital_employed),
    revenue_growth: ga(ratios.revenue_growth),
    net_margin:     ga(ratios.net_margin),
    current_ratio:  ga(ratios.current_ratio),
    interest_coverage: ga(ratios.interest_coverage_ratio),
    auditor:        (f0.auditor&&(f0.auditor.auditor_firm_name||f0.auditor.auditor_name))||null,
    filing_standard: f0.filing_standard||'Schedule III',
    fy_year:        (function(){var y=f0.year||f0.fy||'';var s=String(y);if(!s)return 'FY24';s=s.replace(/[^0-9]/g,'');if(s.length>=4){var yy=parseInt(s.slice(-2));if(yy>=20&&yy<=30)return 'FY'+yy;}return 'FY24';})(),
    inventory_days: ga(ratios.inventory_by_sales_days),
    debtor_days:    ga(ratios.debtors_by_sales_days),
    ebitda_cr:      toCr(li.operating_profit),
    operating_profit: toCr(li.operating_profit),
    profit_before_tax: toCr(li.profit_before_tax),
    cash_and_bank:  toCr(bsA.cash_and_bank_balances),
    trade_receivables: toCr(bsA.trade_receivables),
    inventories_cr: toCr(bsA.inventories),
  };

  return {
    company_name:         d.legal_name || d.company_name || d.name || '',
    cin:                  d.cin || d.llpin || cin,
    status:               d.status || d.efiling_status || 'Active',
    active_compliance:    d.active_compliance || null,
    date_of_incorporation: d.incorporation_date || d.date_of_incorporation || null,
    company_type:         d.classification || d.company_type || null,
    paid_up_capital:      d.paid_up_capital || null,
    authorised_capital:   d.authorized_capital || d.authorised_capital || null,
    registered_state:     (d.registered_address&&d.registered_address.state) || d.registered_state || null,
    last_agm_date:        d.last_agm_date || null,
    last_filing_date:     d.last_filing_date || null,
    listing_status:       d.status || (d.cin&&d.cin[0]==='L'?'Listed':'Unlisted'),
    website:              d.website || null,
    cirp_status:          d.cirp_status || null,
    sum_of_charges:       d.sum_of_charges || null,
    financials: fin,
    related_party_transactions: Array.isArray(raw.related_party_transactions) 
      ? raw.related_party_transactions.slice(0,5).map(function(r){
          return {party:r.party_name||r.name||'',relation:r.relationship||r.relation||'',
                  nature:r.transaction_nature||r.nature||'',amount:r.amount||null};})
      : [],
    compliance: {
      gst_status:         c.gst_status || c.gst || null,
      gst_count:          c.gst_count || c.gst_registrations || null,
      epfo_registered:    c.epfo_registered || c.epfo || false,
      epfo_count:         c.epfo_count || 0,
      roc_filing_status:  c.roc_filing_status || c.roc_compliance || null,
      msme_delays:        c.msme_delays || 0,
      defaulter:          c.defaulter || c.wilful_defaulter || false,
    },
    promoters: d.promoters || d.promoter_holding || {},
    directors: normalizedDirs.slice(0, 15),
    charges: charges.slice(0, 10),
    peer_comparison: peers.slice(0, 5).map(function(p) {
      return { name: p.company_name||p.name||'', cin: p.cin||'',
               revenue: p.revenue||p.revenue_fy24||null,
               pat: p.pat||p.pat_fy24||null, city: p.city||p.state||'' };
    }),
    credit_ratings: cr.slice(0, 6),
  };
}

async function fullPaid({cin='',sector='Manufacturing',exchange='NSE Emerge (SME)',company_name='',board='sme',price_tier='',firm_name=''},key,probeKey) {
  if(!key) return jErr('ANTHROPIC_API_KEY not set',500);
  if(!cin && !company_name) return jErr('CIN or company name required',400);

  const isLLP = /^[A-Z]{3}-\d{4,5}$/i.test((cin||'').trim());
  if(isLLP || !probeKey) return freeAIRA({cin,company_name:company_name||cin,sector,exchange},key);

  /* Probe42 fetch with hard 9s timeout */
  const url=`https://api.probe42.in/probe_pro/companies/${encodeURIComponent(cin)}/comprehensive-details`;
  let flat={};
  let probeOk=false;
  try {
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),9000);
    try {
      const r=await fetch(url,{headers:{'x-api-key':probeKey,'Accept':'application/json','x-api-version':'1.3'},signal:ctrl.signal});
      clearTimeout(tid);
      if(r.ok){
        const raw=await r.json();
        flat=extractProbe42(raw.data||{},cin);
        probeOk=true;
      }
    } catch(fetchErr){ clearTimeout(tid); /* timeout or network error - use AI only */ }
  } catch(e){ /* ignore */ }

  if(!probeOk) return freeAIRA({cin,company_name:company_name||cin,sector,exchange,_note:'AI-only (Probe42 unavailable)'},key);

  /* Build prompt from Probe42 data */
  const f=flat.financials||{},c=flat.compliance||{},dirs=(flat.directors||[]).filter(x=>!x.cessation);
  function fmt(v){return v!=null&&v!==''?String(v):'N/A';}
  function fmtCr(v){if(!v||isNaN(v))return'N/A';const n=Number(v);if(n>=10000000)return'₹'+(n/10000000).toFixed(1)+' Cr';if(n>=100000)return'₹'+(n/100000).toFixed(1)+' L';return'₹'+n.toLocaleString('en-IN');}
  function fmtPct(v){return v!=null&&!isNaN(v)?parseFloat(v).toFixed(1)+'%':'N/A';}

  const dataBlock=`COMPANY: ${fmt(flat.company_name||company_name)} | CIN: ${cin} | Status: ${fmt(flat.status)}
Incorporated: ${fmt(flat.date_of_incorporation)} | Type: ${fmt(flat.company_type)} | Listed: ${fmt(flat.listing_status)}
Paid-up Capital: ${fmtCr(flat.paid_up_capital)} | Authorised: ${fmtCr(flat.authorised_capital)}

FINANCIALS (${fmt(f.fy_year)} | ${fmt(f.filing_standard)}):
Revenue: ${fmtCr(f.revenue_fy24)} | PAT: ${fmtCr(f.pat_fy24)} | EBITDA Margin: ${fmtPct(f.ebitda_margin)}
Net Worth: ${fmtCr(f.net_worth)} | Total Assets: ${fmtCr(f.total_assets)} | Total Debt: ${fmtCr(f.total_debt)}
D/E Ratio: ${fmt(f.debt_equity_ratio)} | ROE: ${fmtPct(f.roe)} | ROCE: ${fmtPct(f.roce)}
Revenue Growth: ${fmtPct(f.revenue_growth)} | Net Margin: ${fmtPct(f.net_margin)}
Auditor: ${fmt(f.auditor)} | Interest Coverage: ${fmt(f.interest_coverage)}x

COMPLIANCE:
GST: ${fmt(c.gst_status)} | ROC Filing: ${fmt(c.roc_filing_status)} | EPFO: ${c.epfo_registered?'Yes':'No'}
Defaulter: ${c.defaulter?'YES - CRITICAL':'No'} | MSME Delays: ${fmt(c.msme_delays||0)}

DIRECTORS (${dirs.length} active):
${dirs.slice(0,5).map(d=>`${d.name||''} | DIN:${d.din||''} | ${d.designation||'Director'} | ${d.gender||''}`).join('\n')}

CHARGES: ${(flat.charges||[]).length} open | Sum: ${fmtCr(flat.sum_of_charges)}
CIRP: ${fmt(flat.cirp_status)||'None'} | SECTOR: ${sector} | EXCHANGE: ${exchange}`;

  const isMB = board==='mainboard'||exchange.toLowerCase().includes('main');
  const prompt=`You are AIRA, a SEBI-expert AI with web search access. Search for recent news, regulatory actions, and sector data on this company, then analyse this ${isMB?'MAINBOARD':'SME IPO'} company and provide a complete IPO Readiness Report.

${dataBlock}

Return EXACTLY this structure:
---JSON---
{"score":<0-100>,"financial":<0-100>,"governance":<0-100>,"compliance":<0-100>,"promoter":<0-100>,"legal":<0-100>,"readiness":<0-100>,"eligibility_verdict":"<verdict>","company_name":"<full company name>"}
---END---

Start the report text with: **Company: [COMPANY NAME]**

Then write the full report with these sections:
## Executive Summary (2 sentences: company + AIRA score verdict)
## SEBI Eligibility (${isMB?'Mainboard':'SME'}: 3-row criteria table)
## Financial Snapshot (Probe42 numbers table: Revenue|PAT|EBITDA%|D/E|ROE)
## Peer Benchmarks (3 listed peers: Company|P/E|EV/EBITDA|Market Cap)
## Key Gaps (top 5, one line each, numbered)
## Score Explanation (each dimension X/100 — one reason)
## Conclusion (verdict + timeline + 3 actions)
Be concise — max 600 words. Complete ALL 7 sections.`;

  let report;
  try { const reportDepth = price_tier==='quick_499'?1200 : price_tier==='deep_2499'?5000 : 3500;
  report=await callClaude(key,prompt,reportDepth); }
  catch(e){ return jErr('Claude error: '+e.message,500); }

  let dims={};
  const jm=report.match(/---JSON---\s*([\s\S]*?)---END---/);
  if(jm){try{dims=JSON.parse(jm[1].trim());}catch(e){}}
  if(dims.company_name && !company_name) company_name = dims.company_name;
  const clean=report.replace(/---JSON---[\s\S]*?---END---/g,'').trim();
  // Extract peer benchmarks from AI report text for the comparison table
  const peerMatches=[...clean.matchAll(/\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|/g)];
  const parsedPeers=peerMatches.slice(1,6).map(m=>{
    const cols=m.slice(1).map(c=>c.trim());
    if(cols[0].match(/^[-\s]+$/))return null;
    return {name:cols[0],revenue:cols[1],margin:cols[2],pe:cols[3],ev:cols[4]||cols[5]||''};
  }).filter(Boolean);
  const score=dims.score||65;
  const cname=flat.company_name||company_name||cin;

  try{await sbInsert('reports',{cin,company_name:cname,sector,exchange,
    tier:price_tier==='ca_bundle_4999'?'ca':board==='mainboard'?'mainboard':'paid',
    score,eligibility_verdict:dims.eligibility_verdict||null,
    financial_score:dims.financial||null,governance_score:dims.governance||null,
    report_text:clean.slice(0,8000),source:'probe42_sandbox'});}catch(e){}

  return jOK({...flat,...dims,score,_report:clean,company_name:cname,cin,sector,exchange,
    peer_comparison:parsedPeers.length?parsedPeers:peers,
    _source:'probe42_sandbox',_type:'full_paid'});
}


async function sbTest() {
  const testData = {
    cin: 'TEST123',
    company_name: 'Test Company',
    sector: 'Test',
    exchange: 'NSE',
    tier: 'free',
    score: 55,
    source: 'test'
  };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(testData)
    });
    const text = await r.text();
    return jOK({ status: r.status, ok: r.ok, response: text.slice(0,500) });
  } catch(e) {
    return jErr('sbTest error: ' + e.message, 500);
  }
}

/* ── ADMIN DATA — proxies Supabase to avoid browser CORS ── */
async function adminData({table='reports', limit=100, order='created_at.desc'}) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}&limit=${limit}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await r.json();
    return jOK({ data, ok: r.ok });
  } catch(e) {
    return jErr('Supabase error: ' + e.message, 500);
  }
}

/* ── AIRA DOC-BASED SCORING ── */
async function airaDoc({company_name,cin,sector,exchange,documents},apiKey){
  if(!company_name) return jErr('company_name required',400);
  const docText = documents || 'No documents provided';

  const prompt = `You are AIRA (AI IPO Readiness Assessor). A company has submitted their actual financial and compliance documents for authenticated scoring.

COMPANY: ${company_name}
CIN: ${cin}
SECTOR: ${sector}
TARGET EXCHANGE: ${exchange}

SUBMITTED DOCUMENTS:
${docText.substring(0,50000)}

Based on the actual documents submitted above, generate a comprehensive AIRA IPO Readiness Score.

SCORING INSTRUCTIONS:
1. Extract actual financial metrics from the documents (Revenue, PAT, EBITDA%, Net Worth, D/E ratio, etc.)
2. Identify compliance status from MCA/governance documents
3. Score each dimension 0-100 based on SEBI ICDR 2018 criteria
4. Be specific — cite actual numbers from the documents
5. If a document is missing, note it and score conservatively

OUTPUT FORMAT:
Start with: AIRA Score: [0-100]

Then provide a structured report with these sections:
## Executive Summary
## Financial Performance (cite actual figures from documents)
## Compliance & Governance Status
## SEBI Eligibility Assessment (${exchange})
## Key Gaps & Remediation Timeline
## IPO Readiness Roadmap

---JSON---
{"financial": [0-100], "governance": [0-100], "compliance": [0-100], "promoter": [0-100], "legal": [0-100], "readiness": [0-100]}
---END---

Be honest and data-driven. This is an authenticated score based on real documents, not AI guesswork.`;

  try {
    const r = await fetch(CLAUDE_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        messages:[{role:'user',content:prompt}]
      })
    });
    const d = await r.json();
    const report = d.content?.[0]?.text || 'Scoring failed';
    const scoreM = report.match(/AIRA Score:\s*(\d+)/i);
    const score = scoreM ? parseInt(scoreM[1]) : 55;

    // Save to Supabase
    // Parse dimension scores from report JSON block
    const docDims = {};
    try {
      const djm = report.match(/---JSON---\s*([\s\S]*?)---END---/);
      if (djm) Object.assign(docDims, JSON.parse(djm[1].trim()));
    } catch(e) {}
    const eligVerd = (report.split('\n').find(function(l){return l.toLowerCase().includes('eligible');}) || '').replace(/[*#]/g,'').trim().slice(0,300);

    await sbInsert('reports',{
      cin: cin||null,
      company_name,
      sector,
      exchange,
      tier: 'doc_paid',
      score,
      eligibility_verdict: eligVerd || null,
      financial_score:   docDims.financial   || null,
      governance_score:  docDims.governance  || null,
      compliance_score:  docDims.compliance  || null,
      promoter_score:    docDims.promoter    || null,
      legal_score:       docDims.legal       || null,
      readiness_score:   docDims.readiness   || null,
      report_text:       report.slice(0, 8000),
      source:            'user_documents',
    });

    return jOK({_report:report, score, company_name, sector, exchange, _source:'user_documents'});
  } catch(e) {
    return jErr('Doc scoring error: '+e.message, 500);
  }
}

/* ── AIRA CLEAN CHIT (₹1,499) ── */
async function airaCleanChit({cin,company_name,sector,exchange},apiKey,probeKey){
  cin = String(cin||'').trim().toUpperCase().replace(/\s+/g,'');
  if(!cin) return jErr('CIN or LLPIN required',400);

  // 1 — Get Probe42 company data (directors, charges, compliance)
  let coData={}, directors=[], charges=[];
  if(probeKey){
    try{
      const _prRace = fetch(`https://api.probe42.in/probe_pro/companies/${encodeURIComponent(cin)}/comprehensive-details`,
        {headers:{'x-api-key':probeKey,'Accept':'application/json','x-api-version':'1.3'}});
      const pr = await Promise.race([_prRace, new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))]);
      const pj = await pr.json();
      coData = pj.data||pj||{};
      directors = coData.authorized_signatories||[];
      charges = (coData.charges||[]).filter(c=>c.status==='Open');
    }catch(e){coData={company_name:company_name,cin};}
  } else {
    coData={company_name:company_name,cin};
  }

  const cname = coData.company_name||company_name||cin;

  // 2 — Public regulatory check via Claude + known public sources
  const dirNames = directors.map(d=>d.name||'').filter(Boolean).join(', ');
  const prompt = `You are AIRA Clean Chit — India's IPO regulatory compliance checker.

COMPANY: ${cname} | CIN: ${cin}
SECTOR: ${sector} | EXCHANGE TARGET: ${exchange}
DIRECTORS: ${dirNames||'Not available'}
OPEN CHARGES: ${charges.length} (lenders: ${charges.slice(0,3).map(c=>c.holder||'').join(', ')})

TASK: Perform a Clean Chit regulatory assessment for IPO purposes based on:

1. SEBI ICDR 2018 compliance flags (§26 disqualifications)
2. Known regulatory enforcement patterns for this sector
3. Director disqualification risk assessment (based on names/sector)
4. Pending charges analysis (${charges.length} open charges found via Probe42)
5. Company status and compliance history
6. BIFR/IBC/NCLT risk indicators

IMPORTANT CHECKS TO ASSESS:
- SEBI debarment risk (based on sector and compliance patterns)
- Director DIN disqualification likelihood
- Wilful defaulter risk (based on charge holders: ${charges.map(c=>c.holder||'').join(', ')})
- CBI/ED/SFIO investigation indicators
- AMFI/ICAI disciplinary action risk (if applicable to sector)
- Company name change in last 1 year (check CIN prefix/incorporation date)
- BIFR referral history indicators

NOTE: This is an AI-based risk assessment pending watchoutinvestors.com API integration (46 regulators). Results are indicative. Full authenticated check requires watchoutinvestors data partnership.

OUTPUT FORMAT:
CLEAN_CHIT_SCORE: [0-100]
OVERALL_STATUS: [CLEAN / CAUTION / HIGH_RISK]

Then provide a structured report:
## Clean Chit Summary
## Director Risk Assessment
## Regulatory Compliance Status (SEBI/MCA/RBI)
## Charges & Liens Analysis
## SEBI ICDR §26 Eligibility Flags
## Recommended Actions Before DRHP

End with:
---JSON---
{"sebi_debarred":false,"director_disqualified":false,"wilful_defaulter":false,"bifr_referred":false,"name_change_risk":false,"open_charges":${charges.length},"clean_chit_score":[0-100],"overall_status":"CLEAN|CAUTION|HIGH_RISK"}
---END---`;

  try{
    const cr = await fetch(CLAUDE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:MODEL,max_tokens:2500,messages:[{role:'user',content:prompt}]})
    });
    const cd = await cr.json();
    const report = cd.content?.[0]?.text||'Clean Chit analysis failed';
    const scoreM = report.match(/CLEAN_CHIT_SCORE:\s*(\d+)/i);
    const statusM = report.match(/OVERALL_STATUS:\s*(\w+)/i);
    const score = scoreM?parseInt(scoreM[1]):70;
    const status = statusM?statusM[1].toUpperCase():'CAUTION';

    // Parse JSON block
    let flags = {};
    const jm = report.match(/---JSON---\s*([\s\S]*?)---END---/);
    if(jm){try{flags=JSON.parse(jm[1].trim());}catch(e){}}

    await sbInsert('reports',{
      cin,company_name:cname,sector,exchange,
      tier:'clean_chit',score,
      eligibility_verdict:status,
      report_text:report.slice(0,3500),
      source:'clean_chit_ai',
      financial_score:null,governance_score:null,
      compliance_score:flags.sebi_debarred===false&&flags.director_disqualified===false?85:40,
      legal_score:flags.wilful_defaulter===false&&flags.bifr_referred===false?80:35,
    });

    return jOK({
      _report:report, score, status,
      company_name:cname, cin, sector, exchange,
      flags, open_charges:charges.length,
      directors_checked:directors.length,
      data_source:'Probe42 + Claude AI (watchoutinvestors.com API integration pending)',
    });
  }catch(e){
    return jErr('Clean Chit error: '+e.message,500);
  }
}

/* ── DIRECTOR RISK SCANNER (₹299/DIN) ── */
async function directorScan({din,director_name,company_cin},apiKey){
  if(!din&&!director_name) return jErr('DIN or director name required',400);

  const prompt = `You are an IPO director risk scanner for India.

INPUT:
DIN: ${din||'Not provided'}
Director Name: ${director_name||'Not provided'}
Associated Company CIN: ${company_cin||'Not provided'}

TASK: Assess regulatory risk for this director based on:

1. Director Disqualification under Companies Act §164(2)(a)
   - Non-filing of financial statements/annual returns for 3+ consecutive years
   - Directors of struck-off companies are disqualified for 5 years

2. SEBI Debarment Check
   - Insider trading, fraudulent trading, market manipulation
   - SEBI ICDR violations

3. DIN Deactivation Check
   - DIR-3 KYC non-compliance

4. CBI/ED/SFIO/ICAI Disciplinary Actions
   - Economic offences, FEMA violations, professional misconduct

5. Wilful Defaulter Status
   - RBI-reported wilful default above ₹25 lakh

6. Past association with shell companies or BIFR-referred entities

IMPORTANT: This is an AI risk assessment. For confirmed regulatory status:
- MCA Disqualification: mca.gov.in/content/mca/global/en/data-and-reports
- SEBI Debarment: nseindia.com debarred list (updated daily)
- Full check: watchoutinvestors.com (46 regulators, authoritative source)

OUTPUT:
RISK_LEVEL: [LOW / MEDIUM / HIGH]
DIN_STATUS: [LIKELY_ACTIVE / REQUIRES_VERIFICATION / LIKELY_DISQUALIFIED]

## Director Risk Summary
## Key Risk Indicators
## Recommended Verification Steps
## Public Sources to Verify

---JSON---
{"din":"${din||'N/A'}","risk_level":"LOW|MEDIUM|HIGH","din_likely_active":true,"sebi_debarment_risk":"LOW|MEDIUM|HIGH","mca_disqualification_risk":"LOW|MEDIUM|HIGH","verify_at":["mca.gov.in","nseindia.com/debarred","watchoutinvestors.com"]}
---END---`;

  try{
    const cr = await fetch(CLAUDE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:MODEL,max_tokens:1200,messages:[{role:'user',content:prompt}]})
    });
    const cd = await cr.json();
    const report = cd.content?.[0]?.text||'Director scan failed';
    const riskM = report.match(/RISK_LEVEL:\s*(\w+)/i);
    const risk = riskM?riskM[1].toUpperCase():'MEDIUM';

    return jOK({
      _report:report, risk, din:din||'N/A',
      director_name:director_name||'Not provided',
      note:'AI risk assessment. Confirm via MCA, NSE debarred list & watchoutinvestors.com',
    });
  }catch(e){
    return jErr('Director scan error: '+e.message,500);
  }
}

/* ── EMAIL ── */
async function sendEmail(body,env) {
  const brevoKey = (typeof env==='string') ? env : (env?.BREVO_API_KEY || '');
  if(!brevoKey) return jErr('BREVO_API_KEY not set in Worker Secrets',503);
  try{
    const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',
      headers:{'api-key':brevoKey,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        sender:{name:'ipowork Intelligence',email:'partners@ipowork.com'},
        to:[{email:body.to||'jiweshkshrivastava@gmail.com'}],
        replyTo:{email:'partners@ipowork.com'},
        subject:body.subject||'ipowork notification',
        htmlContent:body.html||'<p>'+body.subject+'</p>'
      })});
    const d=await r.json();
    if(!r.ok) return jErr('Brevo error: '+JSON.stringify(d),r.status);
    return jOK({sent:true,messageId:d.messageId});
  }catch(e){return jOK({ok:false});}
}

/* ── CLAUDE PROXY ── */
async function claudeProxy(body,key) {
  if(!key) return jErr('ANTHROPIC_API_KEY not set',500);
  const {type:_t, ...claudeBody} = body;
  // Use streaming to avoid 30s timeout for large requests
  const isLarge = (claudeBody.max_tokens||0) > 2000;
  if(isLarge) {
    // Enable streaming for large requests
    claudeBody.stream = true;
  }
  const ctrl = new AbortController();
  const tid = setTimeout(()=>ctrl.abort(), 28000);
  try {
    const r = await fetch(CLAUDE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify(claudeBody),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if(!r.ok) {
      const err = await r.text();
      return jErr('Claude API error: '+err, r.status);
    }
    if(isLarge && claudeBody.stream) {
      // For streaming, collect all chunks and return assembled response
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let inputTokens = 0, outputTokens = 0;
      while(true) {
        const {done, value} = await reader.read();
        if(done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for(const line of lines) {
          if(line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if(data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              if(evt.type === 'content_block_delta' && evt.delta?.text) {
                fullText += evt.delta.text;
              }
              if(evt.type === 'message_delta' && evt.usage) {
                outputTokens = evt.usage.output_tokens || 0;
              }
              if(evt.type === 'message_start' && evt.message?.usage) {
                inputTokens = evt.message.usage.input_tokens || 0;
              }
            } catch(e) {}
          }
        }
      }
      // Return in Claude's standard non-streaming format
      const assembled = {
        id: 'assembled-'+Date.now(),
        type: 'message',
        role: 'assistant',
        content: [{type:'text', text: fullText}],
        model: claudeBody.model || 'claude-sonnet',
        usage: {input_tokens: inputTokens, output_tokens: outputTokens}
      };
      return new Response(JSON.stringify(assembled),{status:200,headers:{...CORS,'Content-Type':'application/json'}});
    }
    return new Response(await r.text(),{status:r.status,headers:{...CORS,'Content-Type':'application/json'}});
  } catch(e) {
    clearTimeout(tid);
    if(e.name === 'AbortError') return jErr('Request timed out — try reducing max_tokens or use a faster model', 504);
    return jErr('Claude proxy error: '+e.message, 500);
  }
}

async function callClaudeDeepResearch(key, probe42Data, cin, companyName, sector, exchange, maxTokens=4000) {
  // Deep Research: Claude with web_search tool + Probe42 verified data
  // Searches for: company news, regulatory actions, sector analysis, recent IPOs
  const systemPrompt = `You are AIRA Deep Research Engine. You have access to Probe42 verified financial data AND web search.
Use web_search to find:
1. Recent news about ${companyName} (last 2 years)
2. Any regulatory/SEBI/MCA actions against ${companyName} or its directors
3. Recent IPOs in ${sector} sector on NSE/BSE (benchmarks)
4. Industry outlook for ${sector} in India
Then combine with the Probe42 data to write a COMPREHENSIVE IPO readiness report.`;

  const userPrompt = `Company: ${companyName} | CIN: ${cin} | Sector: ${sector} | Exchange: ${exchange}

PROBE42 VERIFIED DATA:
${probe42Data}

Search the web for additional intelligence on this company and sector, then write a complete Deep Research IPO Readiness Report with:
## Executive Summary & AIRA Score
## Probe42 Verified Financials Analysis
## Web Research Findings (news, regulatory, market intelligence)  
## SEBI Eligibility Assessment
## Governance & Compliance
## Sector & Competitive Analysis (from web search)
## Key Gaps & Action Plan
## IPO Roadmap
## Score Explanation
## Conclusion`;

  const r = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05'},
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      tools: [{type:'web_search_20250305', name:'web_search', max_uses: 4}],
      system: systemPrompt,
      messages: [{role:'user', content: userPrompt}]
    })
  });

  const txt = await r.text();
  if(!r.ok) throw new Error('Deep Research AI error: '+r.status);
  let d;
  try { d = JSON.parse(txt); } catch(e) { throw new Error('Deep Research parse error'); }
  if(d.error) throw new Error(d.error.message||'Deep Research API error');
  // Extract text from content blocks (may include tool_use and tool_result blocks)
  return (d.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('');
}

async function callClaude(key,prompt,maxTokens=1000,useWebSearch=true) {
  // All AIRA reports use web search by default for live intelligence
  // Max 2 searches to stay within Cloudflare's 30s limit
  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{role:'user', content:prompt}]
  };
  const headers = {
    'Content-Type':'application/json',
    'x-api-key':key,
    'anthropic-version':'2023-06-01'
  };
  if(useWebSearch) {
    body.tools = [{type:'web_search_20250305', name:'web_search', max_uses:2}];
    headers['anthropic-beta'] = 'web-search-2025-03-05';
  }
  const ctrl=new AbortController();
  const cTid=setTimeout(()=>ctrl.abort(),22000); // 22s max for Claude
  let r,txt;
  try{
    r=await fetch(CLAUDE_URL,{method:'POST',headers,body:JSON.stringify(body),signal:ctrl.signal});
    txt=await r.text();
  } finally { clearTimeout(cTid); }
  if(!r.ok){
    // If web search causes error, retry without it
    if(useWebSearch && (r.status===400||r.status===422)) {
      return callClaude(key,prompt,maxTokens,false);
    }
    const numMatch=txt.match(/error code:\s*(\d+)/i);
    const code=numMatch?numMatch[1]:r.status;
    throw new Error('AI service error ('+code+'). Please try again.');
  }
  let d;
  try{ d=JSON.parse(txt); }
  catch(e){ throw new Error('AI response parse error. Please retry.'); }
  if(d.error) throw new Error(d.error.message||'Claude API error');
  // Extract text from all content blocks (text + tool results)
  return (d.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('');
}

/* ── Supabase helpers ── */
async function sbInsert(table, data) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    if (!r.ok) {
      const err = await r.text().catch(()=>'');
      console.error(`sbInsert ${table} failed ${r.status}: ${err.slice(0,200)}`);
    }
    return r.ok;
  } catch(e) {
    console.error('sbInsert error:', e.message);
    return false;
  }
}

async function sbUpsertUser(phone, email) {
  try {
    // Try update first
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?phone=eq.${encodeURIComponent(phone)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ last_seen: new Date().toISOString(), email })
    });
    if (r.ok) {
      const text = await r.text();
      // If no rows updated, insert
      if (!text || text === '[]') {
        await sbInsert('users', { phone, email });
      }
    } else {
      await sbInsert('users', { phone, email });
    }
  } catch(e) {}
}

function jOK(d){return new Response(JSON.stringify(d),{headers:{...CORS,'Content-Type':'application/json'}});}
function jErr(m,s=400){return new Response(JSON.stringify({error:m}),{status:s,headers:{...CORS,'Content-Type':'application/json'}});}


/* ── DEEP RESEARCH: Probe42 + Claude Web Search ── */
/* ══════════════════════════════════════════════════════════
   DEEP RESEARCH PRODUCT — Probe42 + Claude Web Search
   Price: ₹4,999 | Time: ~15 minutes
   ══════════════════════════════════════════════════════════ */
/* ── Email via Brevo ── */



async function deepResearchProduct({cin='',company_name='',sector='Manufacturing',exchange='NSE Emerge (SME)',board='sme'},key,probeKey) {
  if(!key) return jErr('ANTHROPIC_API_KEY not set',500);
  if(!cin) return jErr('CIN required',400);

  // Step 1: Fetch Probe42 comprehensive data (9s timeout)
  const url=`https://api.probe42.in/probe_pro/companies/${encodeURIComponent(cin)}/comprehensive-details`;
  let flat={}, probeOk=false;
  if(probeKey){
    try{
      const ctrl=new AbortController();
      const tid=setTimeout(()=>ctrl.abort(),9000);
      try{
        const r=await fetch(url,{headers:{'x-api-key':probeKey,'Accept':'application/json','x-api-version':'1.3'},signal:ctrl.signal});
        clearTimeout(tid);
        if(r.ok){const raw=await r.json();flat=extractProbe42(raw.data||{},cin);probeOk=true;}
      }catch(e){clearTimeout(tid);}
    }catch(e){}
  }

  const f=flat.financials||{};
  const cname=flat.company_name||company_name||cin;
  function fC(v){if(!v||isNaN(v))return'N/A';const n=Number(v);if(n>=10000000)return'Rs '+(n/10000000).toFixed(1)+' Cr';if(n>=100000)return'Rs '+(n/100000).toFixed(1)+' L';return'Rs '+n.toFixed(0);}
  function fP(v){return v!=null&&!isNaN(v)?parseFloat(v).toFixed(1)+'%':'N/A';}

  const probe42Block = probeOk ? `
=== PROBE42 VERIFIED DATA (MCA/RoC) ===
Company: ${cname} | CIN: ${cin}
Status: ${flat.status||'N/A'} | Type: ${flat.company_type||'N/A'}
Incorporated: ${flat.date_of_incorporation||'N/A'} | State: ${flat.registered_state||'N/A'}
Paid-up Capital: ${fC(flat.paid_up_capital)} | Auth Capital: ${fC(flat.authorised_capital)}
Last AGM: ${flat.last_agm_date||'N/A'} | Last Filing: ${flat.last_filing_date||'N/A'}
CIRP: ${flat.cirp_status||'None'} | Active Compliance: ${flat.active_compliance||'N/A'}

FINANCIALS (${f.fy_year||'FY2024'} | ${f.filing_standard||'Schedule III'}):
Revenue: ${fC(f.revenue_fy24)} | PAT: ${fC(f.pat_fy24)} | EBITDA Margin: ${fP(f.ebitda_margin)}
Net Worth: ${fC(f.net_worth)} | Total Assets: ${fC(f.total_assets)} | Total Debt: ${fC(f.total_debt)}
D/E Ratio: ${f.debt_equity_ratio||'N/A'}x | ROE: ${fP(f.roe)} | ROCE: ${fP(f.roce)}
Revenue Growth: ${fP(f.revenue_growth)} | Net Margin: ${fP(f.net_margin)}
Current Ratio: ${f.current_ratio||'N/A'}x | Interest Coverage: ${f.interest_coverage||'N/A'}x
Auditor: ${f.auditor||'N/A'} | Inventory Days: ${f.inventory_days||'N/A'} | Debtor Days: ${f.debtor_days||'N/A'}

DIRECTORS (${(flat.directors||[]).length} total):
${(flat.directors||[]).filter(d=>!d.cessation).slice(0,8).map(d=>`${d.name} | DIN:${d.din} | ${d.designation} | ${d.gender}`).join('\n')}

CHARGES: ${(flat.charges||[]).length} open charges | Sum: ${fC(flat.sum_of_charges)}
COMPLIANCE: GST:${flat.compliance&&flat.compliance.gst_status||'N/A'} | EPFO:${flat.compliance&&flat.compliance.epfo_registered?'Yes':'No'} | Defaulter:${flat.compliance&&flat.compliance.defaulter?'YES':'No'}
RPT: ${(flat.related_party_transactions||[]).length} related party transactions on record` 
  : `CIN: ${cin} | Company: ${company_name||cin} | Sector: ${sector} | [Probe42 data unavailable - AI analysis only]`;

  // Step 2: Deep Research prompt - Claude uses web search for live intelligence
  // Tier-specific focus
  const tierFocus = board==='mainboard'?'SEBI Mainboard ICDR 2018 (Reg 6) — profitability route, NTA ≥₹3Cr, avg operating profit ≥₹15Cr, paid-up >₹10Cr':
    board==='ca'?'CA/CS Due Diligence Bundle — secretarial compliance, legal DD, promoter lock-in, DRHP pre-check':
    board==='clearchit'?'Regulatory Clean Chit — MCA/ROC compliance, GST status, EPFO, NCLT/NCLAT cases, director DIN checks, CIBIL/defaulter lists':
    board==='valintel'?'IPO Valuation Intelligence — P/E, EV/EBITDA, DCF, NAV methods, listed peer multiples, price band recommendation':
    'SME IPO (NSE Emerge/BSE SME) — paid-up ₹1-25Cr, NTA ≥₹1Cr, EBITDA positive 2/3 years';

  const prompt = `You are AIRA Deep Research Engine — India's most comprehensive AI IPO readiness platform.

You have BOTH:
1. PROBE42 VERIFIED DATA (MCA/RoC verified ground truth)
2. WEB SEARCH ACCESS (live news, regulatory actions, sector analysis)

${probe42Block}

TARGET: ${exchange} | SECTOR: ${sector}

RESEARCH TASKS — Use web search to find:
1. Recent news about "${cname}" (last 2 years) — any controversies, expansions, awards
2. SEBI/MCA/RoC regulatory actions against "${cname}" or its directors (DIN disqualifications etc)
3. Recent IPOs in ${sector} sector on NSE/BSE — pricing, subscription, performance benchmarks
4. ${sector} sector outlook India 2025-26 — tailwinds, headwinds, regulatory changes
5. Comparable listed companies in ${sector} — their P/E, EV/EBITDA, market cap for valuation

Then write a COMPLETE DEEP RESEARCH IPO READINESS REPORT:

---JSON---
{"score":<0-100>,"financial":<0-100>,"governance":<0-100>,"compliance":<0-100>,"promoter":<0-100>,"legal":<0-100>,"readiness":<0-100>,"eligibility_verdict":"<text>","company_name":"${cname}"}
---END---

## Executive Summary
[Company profile + AIRA Score + key verdict + top finding from web research]

## Probe42 Verified Financial Analysis
[Use exact numbers from Probe42 data above — revenue, PAT, margins, ratios]

## Web Research Findings
[What you found online: news, regulatory actions, market position, reputation]

## SEBI ${exchange.toLowerCase().includes('main')?'Mainboard ICDR':'SME IPO'} Eligibility
[Table: all criteria vs company status, cite Probe42 numbers]

## Governance & Board Analysis  
[Analyze each director from Probe42 data + any web findings on directors]

## Compliance & Regulatory Status
[GST, ROC, EPFO, charges from Probe42 + web research on regulatory issues]

## Sector & Competitive Intelligence
[From web search: sector growth, listed peers, recent IPOs, benchmarks]

## Related Party Transactions
[Analyze RPT data from Probe42 + flag any web-found concerns]

## Key Gaps & Action Plan (1-10, numbered, one sentence each + timeline + cost)

## IPO Roadmap
Phase 1 (0-6 months): actions + estimated cost
Phase 2 (6-18 months): actions + estimated cost
Phase 3 (18-36 months): filing readiness + total investment

## Score Explanation
[Each dimension with score/100 and specific reason citing Probe42 data or web findings]

## ${board==='valintel'?'Valuation Summary & Price Band':'Investment Thesis & Risk Assessment'}
[Bull case, bear case, key catalysts, deal breakers]

## Conclusion
[3 sentences: overall verdict + top 3 priorities + realistic IPO timeline]`;

  let report;
  try{
    report = await callClaude(key,prompt,5000,true);
  }catch(e){
    // Fallback without web search
    try{ report = await callClaude(key,prompt,4000,false); }
    catch(e2){ return jErr('Deep Research failed: '+e2.message,500); }
  }

  let dims={};
  const jm=report.match(/---JSON---\s*([\s\S]*?)---END---/);
  if(jm){try{dims=JSON.parse(jm[1].trim());}catch(e){}}
  const clean=report.replace(/---JSON---[\s\S]*?---END---/g,'').trim();
  const score=dims.score||65;

  try{await sbInsert('reports',{cin,company_name:cname,sector,exchange,
    tier:'deep_research',score,
    report_text:clean.slice(0,8000),
    source:probeOk?'probe42_deep_research':'ai_deep_research'});}catch(e){}

  return jOK({...flat,...dims,score,_report:clean,company_name:cname,cin,sector,exchange,
    _source:probeOk?'probe42_deep_research':'ai_deep_research',_type:'full_paid'});
}



async function websiteFetch(body) {
  const CORS2 = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  try {
    const url = body.url||'';
    if(!url || !url.startsWith('http')) return new Response(JSON.stringify({text:'',error:'Invalid URL',ok:false}),{headers:CORS2});
    const resp = await fetch(url, {
      headers:{'User-Agent':'Mozilla/5.0 (compatible; ipowork-research/1.0)'},
      redirect:'follow',
      signal: AbortSignal.timeout(8000)
    });
    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi,'')
      .replace(/<style[\s\S]*?<\/style>/gi,'')
      .replace(/<nav[\s\S]*?<\/nav>/gi,'')
      .replace(/<footer[\s\S]*?<\/footer>/gi,'')
      .replace(/<header[\s\S]*?<\/header>/gi,'')
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
      .replace(/\s{2,}/g,' ').trim()
      .substring(0, body.max_chars||4000);
    return new Response(JSON.stringify({text,url,ok:true}),{headers:CORS2});
  } catch(e) {
    return new Response(JSON.stringify({text:'',error:e.message,ok:false}),{headers:CORS2});
  }
}

export default {
  async fetch(req, env) {
    if (req.method==='OPTIONS') return new Response(null,{status:200,headers:{...CORS,'Content-Length':'0'}});
    if (req.method==='GET') {
      const url = new URL(req.url);
      const debugCin = url.searchParams.get('cin');
      const debugType = url.searchParams.get('type');
      if(debugCin && debugType==='probe42_raw') return probe42Raw(debugCin, env.PROBE42_KEY, env);
      // Raw probe42 test: /?rawtest=CIN
      const rawCin = url.searchParams.get('rawtest');
      if(rawCin) {
        const pk = env.PROBE42_KEY||'';
        const probeUrl = `https://api.probe42.in/probe_pro/companies/${encodeURIComponent(rawCin)}/comprehensive-details`;
        try {
          const r = await fetch(probeUrl, {headers:{'x-api-key':pk,'Accept':'application/json','x-api-version':'1.3'}});
          const txt = await r.text();
          return new Response(JSON.stringify({
            status: r.status,
            key_set: pk.length > 0,
            key_prefix: pk.substring(0,8),
            url_called: probeUrl,
            response: txt.substring(0,500)
          }), {headers:{...CORS,'Content-Type':'application/json'}});
        } catch(e) {
          return new Response(JSON.stringify({error:e.message}),{headers:{...CORS,'Content-Type':'application/json'}});
        }
      }
      // Supabase proxy test: /?supatest=CIN
      const supaCin = url.searchParams.get('supatest');
      if(supaCin) {
        const supaUrl = 'https://esqlfsjhekdspycfgnoz.supabase.co/functions/v1/probe42-proxy';
        // Try every possible env var name
        const supaKey = env.SUPABASE_ANON_KEY
          || env.SUPABASE_KEY
          || env.SUPA_ANON_KEY
          || env.ANON_KEY
          || '';
        // Show ALL env keys for debugging
        const envKeys = Object.keys(env||{});
        try {
          const r = await fetch(supaUrl, {
            method:'POST',
            headers:{'Authorization':`Bearer ${supaKey}`,'Content-Type':'application/json'},
            body: JSON.stringify({endpoint:`companies/${encodeURIComponent(supaCin)}/comprehensive-details`})
          });
          const txt = await r.text();
          return new Response(JSON.stringify({
            supa_status: r.status,
            supa_key_set: supaKey.length > 0,
            supa_key_prefix: supaKey.substring(0,20),
            env_keys_available: envKeys,
            response: txt.substring(0,500)
          }), {headers:{...CORS,'Content-Type':'application/json'}});
        } catch(e) {
          return new Response(JSON.stringify({
            supa_error: e.message,
            env_keys_available: envKeys
          }), {headers:{...CORS,'Content-Type':'application/json'}});
        }
      }
      return new Response('ipowork Worker v10.32 OK',{headers:{...CORS,'Content-Type':'text/plain'}});
    }
    let body={};
    try{body=await req.json();}catch(e){}
    const t = body.type||'';
    const key = env.ANTHROPIC_API_KEY||env.CLAUDE_KEY;
    if(!key && t!=='email' && t!=='admin_data' && t!=='sb_test' && t!=='probe42_raw'){
      return new Response(JSON.stringify({error:'ANTHROPIC_API_KEY not set — add it in Cloudflare Worker Secrets'}),{status:503,headers:{...CORS,'Content-Type':'application/json'}});
    }
    try {
      if(t==='probe42_raw')    return probe42Raw(body.cin,env.PROBE42_KEY,env);
      if(t==='send_email')     return sendEmail(body,env);
      if(t==='company_search') return companySearch(body.query||'',key);
      if(t==='aira_free')      return freeAIRA(body,key);
      if(t==='full_paid')      return fullPaid(body,key,env.PROBE42_KEY);
      if(t==='deep_research')   return deepResearchProduct(body,key,env.PROBE42_KEY);
      if(t==='admin_data')     return adminData(body);
      if(t==='sb_test')        return sbTest();
      if(t==='aira_doc')       return airaDoc(body,key);
      if(t==='valuation_doc')  return valuationDoc(body,key);
      if(t==='valuation_intel')return valuationIntel(body,key,env.PROBE42_KEY);
      if(t==='aira_clean_chit')return airaCleanChit(body,key,env.PROBE42_KEY);
      if(t==='director_scan')  return directorScan(body,key);
      if(t==='email')          return sendEmail(body,env.BREVO_API_KEY);
      if(t==='website_fetch')    return websiteFetch(body);
      return claudeProxy(body,key);
    } catch(e) {
      return new Response(JSON.stringify({error:'Worker error: '+e.message}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
    }
  }
}