// Minigame entry point: register with Slopsmith SDK (Story 10-1).
// No standalone nav or screen — game only runs inside the SDK hub container.
(async function () {
  try {
    const { registerWithSdk } = await import('/plugins/subway-scaler/static/game/SdkBridge.js');
    registerWithSdk();
  } catch (err) {
    console.warn('[SubwayScaler] SDK registration failed silently:', err);
  }
})();
