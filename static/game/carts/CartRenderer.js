import * as THREE from '../vendor/three.module.js';
import { laneX } from '../grid.js';

export class CartRenderer {
  constructor(scene) {
    this.scene = scene;
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    this.bodyMatByColour = new Map();
  }

  getBodyMaterial(colourHex) {
    let m = this.bodyMatByColour.get(colourHex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: colourHex });
      this.bodyMatByColour.set(colourHex, m);
    }
    return m;
  }

  createMesh(cart, colourHex) {
    const bodyMat = this.getBodyMaterial(colourHex);
    const g = new THREE.Group();
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.3), bodyMat);
    body.position.y = 0.45;
    g.add(body);
    
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.4), this.roofMat);
    roof.position.y = 0.9;
    g.add(roof);
    
    g.userData = { position: cart.positionZ, note: cart.noteId };
    this.scene.add(g);
    return g;
  }

  updateMeshPosition(mesh, positionZ, fret, anchorFret) {
    if (mesh) {
      mesh.position.z = positionZ;
      mesh.position.x = laneX(fret, anchorFret);
    }
  }

  removeMesh(mesh) {
    if (mesh) {
      this.scene.remove(mesh);
      // Optional: dispose geometry/material if not reused
    }
  }
}
