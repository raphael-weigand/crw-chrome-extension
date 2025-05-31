// Background Service Worker
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	// Only react to fully loaded pages
	if (changeInfo.status === 'complete' && tab.url) {
		checkConsumerRights(tab.url, tabId);
	}
});

chrome.tabs.onActivated.addListener((activeInfo) => {
	chrome.tabs.get(activeInfo.tabId, (tab) => {
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
	chrome.action.setBadgeText({
		text: violations.length.toString(),
		tabId: tabId
	});
	chrome.action.setBadgeBackgroundColor({
		color: '#ff0000',
		tabId: tabId
	});

	chrome.storage.local.set({
		[`violations_${tabId}`]: {
			companyName: companyName,
			entries: violations,
			timestamp: Date.now()
		}
	});
}

function setCleanBadge(tabId, companyName) {
	chrome.action.setBadgeText({
		text: '✓',
		tabId: tabId
	});
	chrome.action.setBadgeBackgroundColor({
		color: '#008000',
		tabId: tabId
	});

	chrome.storage.local.set({
		[`violations_${tabId}`]: {
			companyName: companyName,
			entries: [],
			timestamp: Date.now()
		}
	});
}

function setErrorBadge(tabId) {
	chrome.action.setBadgeText({
		text: '?',
		tabId: tabId
	});
	chrome.action.setBadgeBackgroundColor({
		color: '#808080',
		tabId: tabId
	});
}

function extractTLD(url) {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;
		const parts = hostname.split('.');
		if (parts.length >= 2) {
			return parts.slice(-2).join('.');
		}
		return hostname;
	} catch (error) {
		console.error('Error extracting TLD:', error);
		return null;
	}
}
