/**
 * ipowork Probe42 Client Library
 * Include in any portal: <script src="probe42.js"></script>
 * Uses Cloudflare Worker as secure proxy — API key never exposed
 */

const WORKER = 'https://flat-bread-b021.jiweshkshrivastava.workers.dev/';

const P42 = {

  // ── CORE REQUEST ──
  async call(action, params={}) {
    const body = { type: 'probe42', action, ...params };
    const resp = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Probe42 error');
    return data.data;
  },

  // ── SEARCH ──
  async search(query) {
    return this.call('search', { query });
  },

  // ── COMPANY PROFILE ──
  async company(cin) {
    return this.call('company', { cin });
  },

  // ── DIRECTORS ──
  async directors(cin) {
    return this.call('directors', { cin });
  },

  // ── CHARGES ──
  async charges(cin) {
    return this.call('charges', { cin });
  },

  // ── FINANCIALS ──
  async financials(cin) {
    return this.call('financials', { cin });
  },

  // ── SHAREHOLDING ──
  async shareholding(cin) {
    return this.call('shareholding', { cin });
  },

  // ── MCA FILINGS ──
  async filings(cin) {
    return this.call('filings', { cin });
  },

  // ── DIRECTOR BY DIN ──
  async din(din) {
    return this.call('din', { din });
  },

  // ── DIRECTOR COMPANY NETWORK ──
  async dinCompanies(din) {
    return this.call('din_companies', { din });
  },

  // ── FULL SCAN (company + directors + charges + financials) ──
  async fullScan(cin) {
    return this.call('fullscan', { cin });
  },

  // ── HELPERS ──

  // Format CIN from search result
  getCIN(company) {
    return company?.cin || company?.CIN || company?.company_cin || '';
  },

  // Get company name
  getName(company) {
    return company?.company_name || company?.name || '';
  },

  // Get registered date
  getIncDate(company) {
    return company?.date_of_incorporation || company?.incorporation_date || '';
  },

  // Get paid up capital
  getPaidUp(company) {
    return company?.paid_up_capital || company?.puc || 0;
  },

  // Get active charges count
  getActiveCharges(charges=[]) {
    return (charges || []).filter(c =>
      (c.status || '').toLowerCase().includes('open') ||
      (c.status || '').toLowerCase().includes('active')
    ).length;
  },

  // Calculate simple AIRA-style score from financials
  quickScore(fin={}) {
    let score = 50;
    if (fin.revenue_growth_3y > 15) score += 10;
    if (fin.pat > 0) score += 10;
    if (fin.de_ratio < 2) score += 10;
    if (fin.icr > 2.5) score += 10;
    if (fin.pat < 0) score -= 20;
    if (fin.de_ratio > 5) score -= 15;
    return Math.max(0, Math.min(100, score));
  }
};

// ── UI HELPERS ──
const P42UI = {

  // Show loading state in an element
  loading(el, msg='Fetching from Probe42...') {
    if (!el) return;
    el.innerHTML = `<div style="padding:30px;text-align:center;color:#6B7E85">
      <div style="font-size:24px;margin-bottom:8px">⏳</div>
      <div style="font-size:12px;font-weight:600">${msg}</div>
    </div>`;
  },

  // Show error state
  error(el, msg='Could not fetch data. Please try again.') {
    if (!el) return;
    el.innerHTML = `<div style="padding:20px;background:rgba(192,57,43,.06);border-radius:10px;border-left:3px solid #C0392B">
      <div style="font-size:12px;font-weight:800;color:#C0392B;margin-bottom:4px">⚠️ Error</div>
      <div style="font-size:11px;color:#6B7E85">${msg}</div>
    </div>`;
  },

  // Render company search results as dropdown options
  renderSearchResults(results=[], onSelect) {
    if (!results.length) return '<div style="padding:12px;font-size:12px;color:#6B7E85">No companies found</div>';
    return results.map(co => {
      const cin = P42.getCIN(co);
      const name = P42.getName(co);
      return `<div onclick="(${onSelect.toString()})('${cin}','${name.replace(/'/g,"\\'")}') "
        style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(13,92,107,.08);font-size:12px;font-weight:600;color:#2C3E47;transition:.1s"
        onmouseover="this.style.background='rgba(13,92,107,.05)'"
        onmouseout="this.style.background=''">
        <div>${name}</div>
        <div style="font-size:10px;font-weight:400;color:#6B7E85;font-family:monospace;margin-top:2px">${cin}</div>
      </div>`;
    }).join('');
  },

  // Format ₹ amounts
  formatINR(val) {
    if (!val) return '—';
    const n = parseFloat(val);
    if (n >= 10000000) return '₹' + (n/10000000).toFixed(1) + ' Cr';
    if (n >= 100000)   return '₹' + (n/100000).toFixed(1) + ' L';
    return '₹' + n.toLocaleString('en-IN');
  },

  // Format percentage
  pct(val) {
    if (val == null) return '—';
    return parseFloat(val).toFixed(1) + '%';
  },

  // Risk color
  riskColor(score) {
    if (score >= 75) return '#1A9E6B';
    if (score >= 50) return '#E88A2E';
    return '#C0392B';
  },

  // Risk label
  riskLabel(score) {
    if (score >= 75) return 'Low Risk';
    if (score >= 50) return 'Moderate Risk';
    return 'High Risk';
  }
};

console.log('✅ ipowork Probe42 Client loaded');
