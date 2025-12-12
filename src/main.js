import './style.css'
import * as THREE from 'three'
import { SplatMesh, dyno } from '@sparkjsdev/spark'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationMixer } from 'three'

// === Setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// 初始化相机位置 (恢复旧的初始设置)
camera.position.set(0, 2, 3.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Controls (Orbit + WASD) ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.enablePan = true;
controls.minDistance = 0.1;
controls.maxDistance = 50;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.0; // Restored

// 初始化位置 (覆盖上面的设置，恢复你的特定视角)
camera.position.set(0.01, 0.71, 0.68);

// Calculate target to match rotation
const pitch = THREE.MathUtils.degToRad(-32);
const yaw = THREE.MathUtils.degToRad(-46);
const roll = THREE.MathUtils.degToRad(-24);
camera.rotation.set(pitch, yaw, roll);

const forward = new THREE.Vector3(0, 0, -1);
forward.applyEuler(camera.rotation).normalize();
const target = camera.position.clone().add(forward.multiplyScalar(1.0));
controls.target.copy(target);
controls.update();

// WASD Movement
const moveSpeed = 0.01;
const keyState = {};
window.addEventListener('keydown', (e) => keyState[e.code] = true);
window.addEventListener('keyup', (e) => keyState[e.code] = false);

function updateCameraMovement() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up).normalize();

  if (keyState['KeyW']) {
    camera.position.addScaledVector(forward, moveSpeed);
    controls.target.addScaledVector(forward, moveSpeed);
  }
  if (keyState['KeyS']) {
    camera.position.addScaledVector(forward, -moveSpeed);
    controls.target.addScaledVector(forward, -moveSpeed);
  }
  if (keyState['KeyA']) {
    camera.position.addScaledVector(right, -moveSpeed);
    controls.target.addScaledVector(right, -moveSpeed);
  }
  if (keyState['KeyD']) {
    camera.position.addScaledVector(right, moveSpeed);
    controls.target.addScaledVector(right, moveSpeed);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Global Variables ===
const animateT = dyno.dynoFloat(0);
let baseTime = 0;
let splatLoaded = false;
let splatMesh = null;
let catModel = null;
let catHitSphere = null;
let butterflyModel = null;
const mixers = [];
const clock = new THREE.Clock();

// === Model Loading ===
const gltfLoader = new GLTFLoader();

// 1. Load Cat
gltfLoader.load('cat.glb', (gltf) => {
  const model = gltf.scene;
  model.name = "Cat";
  model.position.set(-0.1, 0.03, 0.4);
  model.scale.set(0.008, 0.008, 0.008);
  model.rotation.set(0, 0, 0.05);

  // Invisible Hit Sphere for Interaction
  const geometryHit = new THREE.SphereGeometry(0.06, 16, 16);
  const materialHit = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0, // Invisible
    depthTest: false
  });
  catHitSphere = new THREE.Mesh(geometryHit, materialHit);
  catHitSphere.position.copy(model.position);
  catHitSphere.position.y += 0.06;
  catHitSphere.renderOrder = 1000;
  scene.add(catHitSphere);

  // Cat Specific Lighting
  const spotLight = new THREE.SpotLight(0xffffff, 10);
  spotLight.position.set(2, 3.4, -0.17);
  spotLight.target = model;
  spotLight.angle = Math.PI / 6;
  spotLight.penumbra = 0.5;
  spotLight.decay = 2;
  spotLight.distance = 50;

  // Layering for selective lighting
  model.traverse((child) => {
    if (child.isMesh) {
      child.layers.enable(1);
      child.layers.disable(0);
    }
  });
  camera.layers.enable(1);
  spotLight.layers.set(1);

  scene.add(spotLight);
  scene.add(model);
  catModel = model;

  if (gltf.animations.length > 0) {
    const mixer = new AnimationMixer(model);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    mixers.push(mixer);
  }
});

// 2. Load Butterfly
gltfLoader.load('animated_butterfly.glb', (gltf) => {
  const model = gltf.scene;
  model.name = "Butterfly";
  model.position.set(0.73, 0.5, -0.064);
  model.scale.set(0.02, 0.02, 0.02);
  model.rotation.set(0, Math.PI / 4, 0);

  // Initial opacity setup
  model.visible = false;
  model.traverse((child) => {
    if (child.isMesh) {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => {
            const mc = m.clone();
            mc.transparent = true;
            mc.opacity = 0;
            return mc;
          });
        } else {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0;
        }
      }
    }
  });

  scene.add(model);
  butterflyModel = model;

  if (gltf.animations.length > 0) {
    const mixer = new AnimationMixer(model);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    mixers.push(mixer);
  }
});

// === Interaction & Hotspots ===
const HOTSPOTS = [
  {
    position: { x: 0.49, y: 0.32, z: -0.20 },
    title: "Birdbloom",
    content: "A pale rose trembles softly in the breeze as distant birdsong echoes like a memory returning.",
    audioId: "sfx-bird",
    loop: true
  },
  {
    position: { x: 0.74, y: 0.42, z: 0.05 },
    title: "Broken Node",
    content: "The half-broken computer crackles softly, as if a memory is trying to load but can never quite form.",
    audioId: "sfx-buzzing",
    loop: false
  },
  {
    position: { x: 0.69, y: 0.31, z: 0.08 },
    title: "Glyph",
    content: "From the shattered keys comes a faint tapping, as if someone is still typing inside a memory.",
    audioId: "sfx-typing",
    loop: true
  },
  {
    position: { x: 0.20, y: 0.11, z: -0.22 },
    title: "Rootflow",
    content: "A soft trickle echoes beneath the roots, like a memory flowing quietly underground.",
    audioId: "sfx-brook",
    loop: true
  },
  {
    position: { x: 0.68, y: 0.45, z: 0.76 },
    title: "Nightbloom",
    content: "The roses hiding in the shadows glisten with rain, like memories that have just finished crying.",
    audioId: "sfx-rain",
    loop: true
  },
  {
    position: { x: 0.36, y: 0.50, z: -1.20 },
    title: "Frogfall",
    content: "In the distant darkness, a single frog call echoes through the void.",
    audioId: "sfx-cricket",
    loop: true
  }
];

const hotspotGroup = new THREE.Group();
scene.add(hotspotGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let interactables = [];

function updateHotspots() {
  while (hotspotGroup.children.length > 0) {
    hotspotGroup.remove(hotspotGroup.children[0]);
  }
  interactables = [];

  HOTSPOTS.forEach((data) => {
    const container = new THREE.Group();
    container.position.set(data.position.x, data.position.y, data.position.z);
    container.userData = { ...data };

    // Visible Sphere
    const geometryVis = new THREE.SphereGeometry(0.005, 16, 16);
    const materialVis = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false
    });
    const meshVis = new THREE.Mesh(geometryVis, materialVis);
    meshVis.renderOrder = 999;
    container.add(meshVis);

    // Hit Sphere
    const geometryHit = new THREE.SphereGeometry(0.03, 16, 16);
    const materialHit = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false
    });
    const meshHit = new THREE.Mesh(geometryHit, materialHit);
    meshHit.renderOrder = 998;
    meshHit.userData = { parentGroup: container };
    container.add(meshHit);

    hotspotGroup.add(container);
    interactables.push(meshHit);
  });
}
updateHotspots();

// === Glow Effect ===
function generateGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const glowMaterial = new THREE.SpriteMaterial({
  map: generateGlowTexture(),
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const glowSprite = new THREE.Sprite(glowMaterial);
glowSprite.scale.set(0.05, 0.05, 0.05);
glowSprite.renderOrder = 1000;
scene.add(glowSprite);

let hoveredHotspot = null;
let targetGlowOpacity = 0;

// === Events: Pointer Move ===
window.addEventListener('pointermove', (event) => {
  if (!uiFadedIn) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactables);

  let isHoveringCat = false;
  if (catHitSphere) {
    const catIntersects = raycaster.intersectObject(catHitSphere, false);
    if (catIntersects.length > 0) isHoveringCat = true;
  }

  if (intersects.length > 0) {
    const hitObj = intersects[0].object;
    if (hoveredHotspot !== hitObj) {
      hoveredHotspot = hitObj;
      renderer.domElement.style.cursor = 'pointer';
      const container = hitObj.userData.parentGroup;
      glowSprite.position.copy(container.position);
      targetGlowOpacity = 0.8;
    }
  } else if (isHoveringCat) {
    renderer.domElement.style.cursor = 'pointer';
    if (hoveredHotspot) {
      hoveredHotspot = null;
      targetGlowOpacity = 0;
    }
  } else {
    if (hoveredHotspot || renderer.domElement.style.cursor === 'pointer') {
      hoveredHotspot = null;
      renderer.domElement.style.cursor = 'default';
      targetGlowOpacity = 0;
    }
  }
});

document.addEventListener('pointerleave', () => {
  if (hoveredHotspot) {
    hoveredHotspot = null;
    renderer.domElement.style.cursor = 'default';
    targetGlowOpacity = 0;
  }
});

// === Events: Click ===
const mouseDownPos = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
  mouseDownPos.set(event.clientX, event.clientY);
});

window.addEventListener('pointerup', (event) => {
  const moveDistance = Math.hypot(
    event.clientX - mouseDownPos.x,
    event.clientY - mouseDownPos.y
  );
  if (moveDistance >= 5) return; // Ignore drag
  if (event.target.closest('#info-box')) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // 1. Check Cat Click
  if (catHitSphere) {
    const catIntersects = raycaster.intersectObject(catHitSphere, false);
    if (catIntersects.length > 0) {
      playClickSound();
      openDocModal();
      return;
    }
  }

  // 2. Check Hotspot Click
  const intersects = raycaster.intersectObjects(interactables);
  if (intersects.length > 0) {
    const hitObj = intersects[0].object;
    const container = hitObj.userData.parentGroup;
    const data = container.userData;

    playClickSound();

    const infoTitle = document.getElementById('info-title');
    const infoContent = document.getElementById('info-content');

    if (infoTitle) {
      infoTitle.style.display = 'block';
      infoTitle.innerText = data.title || "Unknown Location";
    }
    if (infoContent) {
      infoContent.innerText = data.content;
    }

    const infoBox = document.getElementById('info-box');
    infoBox.style.display = 'block';
    infoBox.offsetHeight; // Reflow
    infoBox.style.opacity = '1';

    if (data.audioId) {
      playAmbientSound(data.audioId, data.loop);
    }

  } else {
    // Click outside: Close
    playClickSound();
    closeInfoBox();
  }
});

// === UI Logic ===
function closeInfoBox() {
  const infoBox = document.getElementById('info-box');
  if (infoBox && infoBox.style.display !== 'none') {
    infoBox.style.opacity = '0';
    stopAmbientSound();
    setTimeout(() => {
      infoBox.style.display = 'none';
    }, 500);
  }
}

const closeBtn = document.getElementById('close-btn');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    playClickSound();
    closeInfoBox();
  });
}

// Documentation Modal
const docModal = document.getElementById('doc-modal');
const closeDocBtn = document.getElementById('close-doc-btn');

function openDocModal() {
  if (docModal) {
    docModal.style.display = 'flex';
    docModal.offsetHeight;
    docModal.style.opacity = '1';

    if (window.gsap) {
      const title = docModal.querySelector('h2');
      const elements = docModal.querySelectorAll('h3, p, .image-gallery');
      window.gsap.set([title, ...elements], { opacity: 0, y: 20 });
      window.gsap.to(title, { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.3 });
      window.gsap.to(elements, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power2.out", delay: 0.5 });
    }
  }
}

function closeDocModal() {
  if (docModal) {
    docModal.style.opacity = '0';
    setTimeout(() => {
      docModal.style.display = 'none';
    }, 500);
  }
}

if (closeDocBtn) {
  closeDocBtn.addEventListener('click', () => {
    playClickSound();
    closeDocModal();
  });
}

if (docModal) {
  docModal.addEventListener('click', (e) => {
    if (e.target === docModal) closeDocModal();
  });
}

// === Audio System ===
const bgMusic = document.getElementById('bg-music');
if (bgMusic) bgMusic.volume = 0.4;

const sfxClick = document.getElementById('sfx-click');
let currentAmbientSound = null;

function playClickSound() {
  if (!sfxClick) return;
  sfxClick.currentTime = 0;
  sfxClick.volume = 0.6;
  sfxClick.play().catch(() => { });
}

function playAmbientSound(audioId, isLoop) {
  stopAmbientSound();
  const audio = document.getElementById(audioId);
  if (!audio) return;
  currentAmbientSound = audio;
  audio.loop = isLoop;
  audio.currentTime = 0;
  audio.volume = 1.0;
  audio.play().catch(e => console.error("Audio error:", e));
}

function stopAmbientSound() {
  if (!currentAmbientSound) return;
  const audio = currentAmbientSound;
  currentAmbientSound = null;
  audio.pause();
  audio.currentTime = 0;
}

function tryPlayMusic() {
  if (!bgMusic) return;
  bgMusic.play()
    .then(() => { })
    .catch(e => {
      const playOnInteraction = () => {
        bgMusic.play().then(() => {
          window.removeEventListener('click', playOnInteraction);
          window.removeEventListener('keydown', playOnInteraction);
        });
      };
      window.addEventListener('click', playOnInteraction);
      window.addEventListener('keydown', playOnInteraction);
    });
}
tryPlayMusic();

// === Splat Loading & Shader ===
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

async function loadSplat(urlOrBuffer, isBuffer = false) {
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '1';
    loadingOverlay.style.pointerEvents = 'auto';
  }

  if (splatMesh) {
    scene.remove(splatMesh);
    if (splatMesh.geometry) splatMesh.geometry.dispose();
    if (splatMesh.material) splatMesh.material.dispose();
    splatMesh = null;
  }

  splatLoaded = false;

  try {
    if (isBuffer) {
      splatMesh = new SplatMesh({ fileBytes: urlOrBuffer });
    } else {
      splatMesh = new SplatMesh({ url: urlOrBuffer });
    }

    splatMesh.quaternion.set(0, 0, 0, 1);
    splatMesh.position.set(0, 0, 0);
    splatMesh.scale.set(1, 1, 1);

    scene.add(splatMesh);
    await splatMesh.loaded;

    splatLoaded = true;
    baseTime = 0;
    setupSplatModifier();

  } catch (e) {
    console.error("Load error:", e);
    if (loadingText) loadingText.innerText = "Error";
  }
}

function setupSplatModifier() {
  if (!splatMesh) return;

  splatMesh.objectModifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const d = new dyno.Dyno({
        inTypes: { gsplat: dyno.Gsplat, t: "float", effectType: "int" },
        outTypes: { gsplat: dyno.Gsplat },
        globals: () => [
          dyno.unindent(`
          vec3 hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(vec3(p.x * p.y * p.z, p.x + p.y * p.z, p.x * p.y + p.z));
          }
          vec3 noise(vec3 p) {
            vec3 i = floor(p); vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                           mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                           mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
          }
          mat2 rot(float a) { float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
        `)
        ],
        statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        float t = ${inputs.t};
        float s = smoothstep(0.,25.,t-4.5)*10.;
        
        vec3 scales = ${inputs.gsplat}.scales;
        vec3 localPos = ${inputs.gsplat}.center;
        float l = length(localPos.xz);
        
        // Magic Effect
        if (${inputs.effectType} == 1) { 
          float border = abs(s-l-.5);
          localPos *= 1.-.2*exp(-20.*border);
          vec3 finalScales = mix(scales,vec3(0.002),smoothstep(s-.5,s,l+.5));
          ${outputs.gsplat}.center = localPos + .1*noise(localPos.xyz*2.+t*.5)*smoothstep(s-.5,s,l+.5);
          ${outputs.gsplat}.scales = finalScales;
          float at = atan(localPos.x,localPos.z)/3.1416;
          ${outputs.gsplat}.rgba *= step(at,t-3.1416);
          ${outputs.gsplat}.rgba += exp(-20.*border) + exp(-50.*abs(t-at-3.1416))*.5;
        }
      `),
      });

      // Default Effect: "Magic" (1)
      gsplat = d.apply({
        gsplat,
        t: animateT,
        effectType: dyno.dynoInt(1)
      }).gsplat;

      return { gsplat };
    });
  splatMesh.updateGenerator();
}

// === Drag & Drop Upload ===
const dropOverlay = document.getElementById('drop-overlay');
if (dropOverlay) {
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
  });
  window.addEventListener('dragleave', (e) => {
    if (e.target === dropOverlay) dropOverlay.classList.remove('active');
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const buffer = await file.arrayBuffer();
      loadSplat(new Uint8Array(buffer), true);
    }
  });
}

// === Initialization ===
fetch('testing.ply', { method: 'HEAD' })
  .then(res => {
    if (res.ok) loadSplat('testing.ply');
    else {
      // Fallback
      loadSplat('https://sparkjs.dev/examples/assets/splats/primerib-tamos.spz');
    }
  })
  .catch(() => loadSplat('https://sparkjs.dev/examples/assets/splats/primerib-tamos.spz'));

// === Render Loop ===
let uiFadedIn = false;

renderer.setAnimationLoop((time) => {
  updateCameraMovement();

  const delta = clock.getDelta();
  mixers.forEach(mixer => mixer.update(delta));

  if (splatLoaded) {
    baseTime += 1 / 60;
    animateT.value = baseTime;

    // Fade Out Loading
    if (baseTime > 4.5) {
      if (loadingOverlay && loadingOverlay.style.opacity !== '0' && loadingOverlay.style.display !== 'none') {
        const fadeDuration = 4.0;
        const opacity = Math.max(0, 1.0 - (baseTime - 4.5) / fadeDuration);
        loadingOverlay.style.opacity = opacity.toString();

        if (opacity <= 0.001) {
          loadingOverlay.style.opacity = '0';
          loadingOverlay.style.pointerEvents = 'none';
          setTimeout(() => {
            loadingOverlay.style.display = 'none';
          }, 100);
        }
      }
    }

    // Fade In UI
    if (baseTime > 10.0) {
      if (!uiFadedIn) {
        if (document.getElementById('site-title')) document.getElementById('site-title').style.opacity = '1';
        if (document.getElementById('upload-hint')) document.getElementById('upload-hint').style.opacity = '1';
        uiFadedIn = true;
      }

      // Fade in Hotspots
      hotspotGroup.children.forEach(container => {
        const visMesh = container.children[0];
        if (visMesh && visMesh.material.opacity < 1.0) {
          visMesh.material.opacity += 0.01;
        }
      });

      if (butterflyModel) {
        butterflyModel.visible = true;
        butterflyModel.traverse(child => {
          if (child.isMesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => {
                if (m.opacity < 1.0) m.opacity += 0.005;
              });
            } else if (child.material && child.material.opacity < 1.0) {
              child.material.opacity += 0.005;
            }
          }
        });
      }
    }
  }

  if (splatMesh) splatMesh.updateVersion();

  controls.update();

  // Glow Opacity Update
  if (uiFadedIn) {
    glowMaterial.opacity += (targetGlowOpacity - glowMaterial.opacity) * 0.1;
    glowSprite.visible = glowMaterial.opacity > 0.01;
  }

  renderer.render(scene, camera);
});
