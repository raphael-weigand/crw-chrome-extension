document.addEventListener('DOMContentLoaded', async () => {
	const domainNameEl = document.getElementById('domainName');
	const statusEl = document.getElementById('status');
	const violationsListEl = document.getElementById('violationsList');

	try {
		// Get current tab info
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		if (!tab.url) {
			showError('No URL available');
			return;
		}

		const companyName = extractCompanyName(tab.url);
		domainNameEl.textContent = companyName || 'Unknown Company';

		// Get stored data for this (open) tab
		const data = await chrome.storage.local.get(`violations_${tab.id}`);
		const violationData = data[`violations_${tab.id}`];

		if (violationData) {
			displayResults(violationData);
		} else {
			// Fallback: Direct API query
			await checkCompanyDirectly(companyName);
		}

	} catch (error) {
		console.error('Popup error:', error);
		showError('Error loading data');
	}
});

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
		return null;
	}
}

async function checkCompanyDirectly(companyName) {
	const statusEl = document.getElementById('status');

	try {
		// Search for articles with the company name
		const searchResponse = await fetch(`https://consumerrights.wiki/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=20&format=json&origin=*`);
		const searchData = await searchResponse.json();

		if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
			displayResults({ companyName: companyName, entries: [], timestamp: Date.now() });
			return;
		}

		// All found articles are potential hits
		const violations = searchData.query.search.map(article => ({
			title: article.title,
			description: article.snippet || 'No preview available',
			url: `https://consumerrights.wiki/${encodeURIComponent(article.title)}`,
			size: article.size || 0
		}));

		displayResults({
			companyName: companyName,
			entries: violations,
			timestamp: Date.now()
		});

	} catch (error) {
		console.error('API error:', error);
		statusEl.innerHTML = `
	  <span style="color: #856404;">⚠️ No connection to API</span>
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
	  <span>⚠️ ${data.entries.length} article${data.entries.length > 1 ? 's' : ''} about "${data.companyName}" found</span>
	`;
		statusEl.className = 'status violations';

		// Show violations
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
		// No violations
		statusEl.innerHTML = `
	  <span>✅ No articles about "${data.companyName}" found</span>
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
	div.textContent = text;
	return div.innerHTML;
}
