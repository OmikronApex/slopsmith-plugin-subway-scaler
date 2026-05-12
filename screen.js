async function refreshSubwayScalerStatus() {
    const statusEl = document.getElementById('subway-scaler-status');
    if (!statusEl) return;
    statusEl.textContent = 'Refreshing...';
    try {
        const resp = await fetch('/api/plugins/subway_scaler/status');
        const data = await resp.json();
        statusEl.textContent = data.message;
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
    }
}

// Initial load
(function() {
    // When the screen becomes active
    if (window.slopsmith) {
        window.slopsmith.on('screen:changed', (e) => {
            if (e.detail.id === 'plugin-subway_scaler') {
                refreshSubwayScalerStatus();
            }
        });
    }
})();
