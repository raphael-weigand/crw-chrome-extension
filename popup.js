document.addEventListener('DOMContentLoaded', async () => {
	const domainNameEl = document.getElementById('domainName');
	const statusEl = document.getElementById('status');
	const violationsListEl = document.getElementById('violationsList');

	try {
		// Get current tab information
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		if (!tab.url) {
			showError('No URL available');
			return;
		}

		const companyName = extractCompanyName(tab.url);
		domainNameEl.textContent = companyName || 'Unknown company';

		// Load stored data for current tab 
		const data = await chrome.storage.local.get(`violations_${tab.id}`);
		const violationData = data[`violations_${tab.id}`];

		if (violationData) {
			displayResults(violationData);
		} else {
			// Fallback: direct API call
			await checkCompanyDirectly(companyName);
		}

	} catch (error) {
		console.error('Popup error:', error);
		showError('Error while loading data');
	}
});

function extractCompanyName(url) {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;

		// Extract company name from URL (www.company-name.com -> company-name.com)
		let domain = hostname.replace(/^www\./, '');

		// Get everything before the first dot
		const parts = domain.split('.');
		if (parts.length >= 2) {
			return parts[0]; // company-name.com -> company-name
		}

		return domain;
	} catch (error) {
		return null;
	}
}

async function checkCompanyDirectly(companyName) {
	const statusEl = document.getElementById('status');

	try {
		// Get articles by company name
		const searchResponse = await fetch(`https://consumerrights.wiki/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=20&format=json&origin=*`);
		const searchData = await searchResponse.json();

		if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
			displayResults({ companyName: companyName, entries: [], timestamp: Date.now() });
			return;
		}

		// All articles are potential matches
		const violations = searchData.query.search.map(article => ({
			title: article.title,
			description: article.snippet || 'No preview possible',
			url: `https://consumerrights.wiki/${encodeURIComponent(article.title)}`,
			size: article.size || 0
		}));

		displayResults({
			companyName: companyName,
			entries: violations,
			timestamp: Date.now()
		});

	} catch (error) {
		console.error('API-Error:', error);
		statusEl.innerHTML = `
	  <span style="color: #856404;">⚠️No connection to API possible</span>
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
		// No violations found
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

