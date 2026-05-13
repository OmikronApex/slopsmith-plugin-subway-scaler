async function refreshSubwayScalerStatus() {
    const statusEl = document.getElementById('subway-scaler-status');
    if (!statusEl) return;
    statusEl.textContent = 'Refreshing...';
    try {
        const resp = await fetch('/api/plugins/subway-scaler/status');
        const data = await resp.json();
        statusEl.textContent = data.message;
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
    }
}

let __subwayScalerBooted = false;
async function bootSubwayScaler() {
    if (__subwayScalerBooted) return;
    const root = document.getElementById('subway-scaler-root');
    if (!root) return;
    __subwayScalerBooted = true;
    try {
        const mod = await import('/plugins/subway-scaler/static/game/main.js');
        await mod.bootstrap(root);
    } catch (err) {
        root.textContent = 'Failed to load game: ' + err.message;
        __subwayScalerBooted = false;
    }
}

(function() {
    if (window.slopsmith) {
        window.slopsmith.on('screen:changed', (e) => {
            if (e.detail.id === 'plugin-subway-scaler') {
                refreshSubwayScalerStatus();
                bootSubwayScaler();
            }
        });
    }
})();
