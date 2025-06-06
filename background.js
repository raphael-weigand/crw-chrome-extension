// Firefox Background Script (compatible with both Chrome and Firefox APIs)

// Use browser API (Firefox) or chrome API (Chrome) 
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react to fully loaded pages
  if (changeInfo.status === 'complete' && tab.url) {
    checkConsumerRights(tab.url, tabId);
  }
});

browserAPI.tabs.onActivated.addListener((activeInfo) => {
  browserAPI.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      checkConsumerRights(tab.url, activeInfo.tabId);
    }
  });
});

async function checkConsumerRights(url, tabId) {
  try {
    // Parse URL and extract company name
    const companyName = extractCompanyName(url);
    if (!companyName) return;
    
    // Search for articles with the company name
    const searchUrl = `https://consumerrights.wiki/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=20&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
      setCleanBadge(tabId, companyName);
      return;
    }
    
    // All found articles are potential hits
    const violations = searchData.query.search.map(article => ({
      title: article.title,
      description: article.snippet || 'No preview available',
      url: `https://consumerrights.wiki/${encodeURIComponent(article.title)}`,
      size: article.size || 0
    }));
    
    // Set badge and data
    if (violations.length > 0) {
      setViolationBadge(tabId, violations, companyName);
    } else {
      setCleanBadge(tabId, companyName);
    }
    
  } catch (error) {
    console.error('Error checking Consumer Rights:', error);
    setErrorBadge(tabId);
  }
}

function extractCompanyName(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Remove www. and other subdomains
    let domain = hostname.replace(/^www\./, '');
    
    // Extract company name (everything before the first dot)
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return parts[0]; // volkswagen from volkswagen.de
    }
    
    return domain;
  } catch (error) {
    console.error('Error extracting company name:', error);
    return null;
  }
}

function setViolationBadge(tabId, violations, companyName) {
  // Firefox uses browserAction, Chrome uses action (v3) or browserAction (v2)
  const badgeAPI = browserAPI.browserAction || browserAPI.action;
  
  badgeAPI.setBadgeText({
    text: violations.length.toString(),
    tabId: tabId
  });
  badgeAPI.setBadgeBackgroundColor({
    color: '#ff0000',
    tabId: tabId
  });
  
  browserAPI.storage.local.set({
    [`violations_${tabId}`]: {
      companyName: companyName,
      entries: violations,
      timestamp: Date.now()
    }
  });
}

function setCleanBadge(tabId, companyName) {
  const badgeAPI = browserAPI.browserAction || browserAPI.action;
  
  badgeAPI.setBadgeText({
    text: '✓',
    tabId: tabId
  });
  badgeAPI.setBadgeBackgroundColor({
    color: '#008000',
    tabId: tabId
  });
  
  browserAPI.storage.local.set({
    [`violations_${tabId}`]: {
      companyName: companyName,
      entries: [],
      timestamp: Date.now()
    }
  });
}

function setErrorBadge(tabId) {
  const badgeAPI = browserAPI.browserAction || browserAPI.action;
  
  badgeAPI.setBadgeText({
    text: '?',
    tabId: tabId
  });
  badgeAPI.setBadgeBackgroundColor({
    color: '#808080',
    tabId: tabId
  });
}
