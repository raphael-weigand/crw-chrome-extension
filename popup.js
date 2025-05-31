document.addEventListener('DOMContentLoaded', async () => {
  const domainNameEl = document.getElementById('domainName');
  const statusEl = document.getElementById('status');
  const violationsListEl = document.getElementById('violationsList');
  
  try {
    // Aktuelle Tab-Info abrufen
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url) {
      showError('Keine URL verfügbar');
      return;
    }
    
    const companyName = extractCompanyName(tab.url);
    domainNameEl.textContent = companyName || 'Unbekannte Firma';
    
    // Gespeicherte Daten für diesen Tab abrufen
    const data = await chrome.storage.local.get(`violations_${tab.id}`);
    const violationData = data[`violations_${tab.id}`];
    
    if (violationData) {
      displayResults(violationData);
    } else {
      // Fallback: Direkte API-Abfrage
      await checkCompanyDirectly(companyName);
    }
    
  } catch (error) {
    console.error('Popup Fehler:', error);
    showError('Fehler beim Laden der Daten');
  }
});

function extractCompanyName(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Entferne www. und andere Subdomains
    let domain = hostname.replace(/^www\./, '');
    
    // Extrahiere den Firmennamen (alles vor dem ersten Punkt)
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return parts[0]; // volkswagen aus volkswagen.de
    }
    
    return domain;
  } catch (error) {
    return null;
  }
}

async function checkCompanyDirectly(companyName) {
  const statusEl = document.getElementById('status');
  
  try {
    // Suche nach Artikeln mit dem Firmennamen
    const searchResponse = await fetch(`https://consumerrights.wiki/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=20&format=json&origin=*`);
    const searchData = await searchResponse.json();
    
    if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
      displayResults({ companyName: companyName, entries: [], timestamp: Date.now() });
      return;
    }
    
    // Alle gefundenen Artikel sind potentielle Treffer
    const violations = searchData.query.search.map(article => ({
      title: article.title,
      description: article.snippet || 'Keine Vorschau verfügbar',
      url: `https://consumerrights.wiki/${encodeURIComponent(article.title)}`,
      size: article.size || 0
    }));
    
    displayResults({
      companyName: companyName,
      entries: violations,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('API-Fehler:', error);
    statusEl.innerHTML = `
      <span style="color: #856404;">⚠️ Keine Verbindung zur API</span>
    `;
    statusEl.className = 'status loading';
  }
}

function displayResults(data) {
  const statusEl = document.getElementById('status');
  const violationsListEl = document.getElementById('violationsList');
  
  if (data.entries && data.entries.length > 0) {
    // Violations found
    statusEl.innerHTML = `
      <span>⚠️ ${data.entries.length} Articles found for "${data.companyName}"</span>
    `;
    statusEl.className = 'status violations';
    
    // Verstöße anzeigen
    violationsListEl.innerHTML = '';
    data.entries.forEach(entry => {
      const violationEl = document.createElement('div');
      violationEl.className = 'violation-item';
      violationEl.innerHTML = `
        <div class="violation-title">
          <a href="${escapeHtml(entry.url)}" target="_blank" style="color: #721c24; text-decoration: none;">
            ${escapeHtml(entry.title)}
          </a>
        </div>
        <div class="violation-description">${escapeHtml(entry.description)}</div>
      `;
      violationsListEl.appendChild(violationEl);
    });
    
    violationsListEl.style.display = 'block';
    
  } else {
    // Keine Verstöße
    statusEl.innerHTML = `
      <span>✅ Keine Artikel zu "${data.companyName}" gefunden</span>
    `;
    statusEl.className = 'status clean';
    violationsListEl.style.display = 'none';
  }
}

function showError(message) {
  const statusEl = document.getElementById('status');
  statusEl.innerHTML = `<span style="color: #721c24;">❌ ${message}</span>`;
  statusEl.className = 'status violations';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.innerHTML;
}
