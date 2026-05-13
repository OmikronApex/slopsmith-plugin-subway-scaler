// Three.js scene: track, current cart, queue of upcoming carts, character, cliff.
import * as THREE from './vendor/three.module.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
  renderer.setClearColor(0x101a2a);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101a2a, 30, 80);

  const camera = new THREE.PerspectiveCamera(60, (canvas.width / canvas.height) || 16 / 9, 0.1, 200);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 1, 0);

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(5, 10, 7);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  // Track
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x444c5a });
  const trackGeom = new THREE.BoxGeometry(2.2, 0.1, 60);
  const track = new THREE.Mesh(trackGeom, trackMat);
  track.position.set(0, 0, -15);
  scene.add(track);

  // Cliff edge (front of scene)
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x2a2118 });
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 4), cliffMat);
  cliff.position.set(0, -0.3, 12);
  scene.add(cliff);

  // Carts
  const cartMat = new THREE.MeshStandardMaterial({ color: 0xffaa33 });
  const upcomingMat = new THREE.MeshStandardMaterial({ color: 0x66aaff });

  function makeCart(material) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 2.4), material);
    body.position.y = 0.6;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 2.5), new THREE.MeshStandardMaterial({ color: 0x666666 }));
    roof.position.y = 1.15;
    g.add(roof);
    return g;
  }

  const currentCart = makeCart(cartMat);
  currentCart.position.set(0, 0.05, 6);
  scene.add(currentCart);

  // Character
  const charMat = new THREE.MeshStandardMaterial({ color: 0xff4488 });
  const character = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 8), charMat);
  character.position.copy(currentCart.position);
  character.position.y = 1.6;
  scene.add(character);

  // Upcoming carts (max 3)
  const upcomingCarts = [];
  for (let i = 0; i < 3; i++) {
    const c = makeCart(upcomingMat);
    c.visible = false;
    upcomingCarts.push(c);
    scene.add(c);
  }
  // HUD labels are drawn in the DOM (see main.js); no in-scene text to avoid font loading.

  // Optional FPS overlay (toggle with ?fps=1)
  const showFps = typeof window !== 'undefined' && /[?&]fps=1/.test(window.location.search);
  const fpsEl = (() => {
    if (!showFps || !canvas.parentElement) return null;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.6);color:#0f0;font:11px monospace;padding:2px 4px;border-radius:3px;';
    canvas.parentElement.style.position = canvas.parentElement.style.position || 'relative';
    canvas.parentElement.appendChild(div);
    return div;
  })();
  let fpsFrames = 0;
  let fpsLast = 0;

  let upcomingNames = [];
  let charY = 1.6;
  let jumpVelocity = 0;
  let falling = false;
  let cliffOffset = 0;
  let succeeded = false;
  let lastTime = 0;

  function placeUpcoming() {
    for (let i = 0; i < upcomingCarts.length; i++) {
      const c = upcomingCarts[i];
      const has = i < upcomingNames.length;
      c.visible = has;
      if (has) {
        c.position.set(-3.5 - i * 3.5, 0.05, 6 - i * 0.5);
      }
    }
  }

  return {
    setUpcomingNotes(names) {
      upcomingNames = names || [];
      placeUpcoming();
    },
    jumpToNext() {
      jumpVelocity = 6;
      // Shift upcoming queue forward
      upcomingNames = upcomingNames.slice(1);
      placeUpcoming();
    },
    dropOffCliff() {
      falling = true;
    },
    showSuccess() {
      succeeded = true;
    },
    render(nowMs) {
      const dt = lastTime ? Math.min(0.05, (nowMs - lastTime) / 1000) : 0.016;
      lastTime = nowMs;

      // Slow forward drift of carts toward cliff
      if (!falling && !succeeded) {
        cliffOffset += dt * 0.3;
        currentCart.position.z = 6 + cliffOffset;
        for (const c of upcomingCarts) {
          if (c.visible) c.position.x += dt * 0.5;
        }
      }
      // Character jump arc
      charY += jumpVelocity * dt;
      jumpVelocity -= 18 * dt;
      if (charY < 1.6) { charY = 1.6; jumpVelocity = 0; }
      character.position.y = charY;
      character.position.z = currentCart.position.z;

      if (falling) {
        currentCart.position.y -= dt * 8;
        currentCart.rotation.x += dt * 1.5;
        character.position.y -= dt * 8;
      }
      if (succeeded) {
        character.rotation.y += dt * 2;
      }

      renderer.render(scene, camera);

      if (fpsEl) {
        fpsFrames++;
        if (!fpsLast) fpsLast = nowMs;
        if (nowMs - fpsLast >= 500) {
          const fps = (fpsFrames * 1000) / (nowMs - fpsLast);
          fpsEl.textContent = `${fps.toFixed(0)} fps`;
          fpsFrames = 0;
          fpsLast = nowMs;
        }
      }
    },
  };
}
