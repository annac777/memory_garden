import './style.css'
import * as THREE from 'three'
import { SplatMesh, dyno } from '@sparkjsdev/spark'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DragControls } from 'three/examples/jsm/controls/DragControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationMixer } from 'three' // Added AnimationMixer
import { addLight } from './addLight' // Added addLight import
import GUI from 'lil-gui'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// Add Light
// const light = addLight();
// scene.add(light);
// const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Add ambient light
// scene.add(ambientLight);

// 初始化相机位置
camera.position.set(0, 2, 3.5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === 控制器设置 (OrbitControls + WASD) ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.enablePan = true;
controls.minDistance = 0.1;
controls.maxDistance = 50;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.0;

// 初始化位置
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

// WASD Movement Logic
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

// 动画变量
const animateT = dyno.dynoFloat(0);
let baseTime = 0;
let splatLoaded = false;
let splatMesh = null;
let catModel = null;
let catHitSphere = null; // Debug hit sphere
let butterflyModel = null;
const mixers = []; // For GLB animations
const clock = new THREE.Clock(); // For animation updates

// 特效配置
const effectParams = {
  effect: "Magic"
};

// === 额外模型加载 (Restored Cat & Butterfly) ===
// const draggableObjects = []; // Removed draggableObjects array
const gltfLoader = new GLTFLoader();

// Load Cat
gltfLoader.load('cat.glb', (gltf) => {
  const model = gltf.scene;
  model.name = "Cat";
  model.position.set(-0.1, 0.03, 0.4); // Position: 0.6, 0.3, 0.2
  // Smaller scale: 0.08 / 100 = 0.0008
  model.scale.set(0.008, 0.008, 0.008);
  model.rotation.set(0, 0, 0.05); // Rotate 180 deg to face camera if needed

  // Create Interaction Hit Sphere (Visible for debugging)
  const geometryHit = new THREE.SphereGeometry(0.06, 16, 16);
  const materialHit = new THREE.MeshBasicMaterial({
    color: 0xff0000,     // Red
    transparent: true,
    opacity: 0,        // Fully transparent (Invisible)
    depthTest: false     // Always visible on top
  });
  catHitSphere = new THREE.Mesh(geometryHit, materialHit);
  // Match cat position exactly
  catHitSphere.position.copy(model.position);
  // Move it up slightly to cover the body
  catHitSphere.position.y += 0.06;

  catHitSphere.renderOrder = 1000;
  scene.add(catHitSphere);

  // Setup specialized lighting for the Cat (Right side only)
  const spotLight = new THREE.SpotLight(0xffffff, 10); // Reduced intensity from 50 to 5
  // Previous pos: 2, 0.5, 0.36. Cat pos: 0.49, 0.05, 0.36. 
  // Cat is facing -Z (rotated 180 deg Y, so facing +Z locally, but in world... let's check rotation)
  // Cat rotation is (0, PI, -0.1). PI rotation around Y means it faces opposite to initial default (usually +Z is front, so now -Z is front)
  // To hit its RIGHT side:
  // If facing -Z, its Right is -X.
  // So light should be at x < 0.49.
  spotLight.position.set(2, 3.4, -0.17);
  spotLight.target = model;
  spotLight.angle = Math.PI / 6;
  spotLight.penumbra = 0.5;
  spotLight.decay = 2;
  spotLight.distance = 50;

  // Use layers to isolate light to Cat only
  // Layer 1 will be for Cat and its specific light
  model.traverse((child) => {
    if (child.isMesh) {
      child.layers.enable(1); // Enable layer 1
      child.layers.disable(0); // Disable layer 0 (optional, if we want it ONLY lit by this light, but then main camera might not see it unless we enable layer 1 on camera)
    }
  });

  // We need the camera to see layer 1 as well
  camera.layers.enable(1);

  // Set light to layer 1 only
  spotLight.layers.set(1);

  scene.add(spotLight);
  scene.add(model);
  catModel = model; // Store reference
  //   draggableObjects.push(model);

  if (gltf.animations.length > 0) {
    const mixer = new AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });
    mixers.push(mixer);
  }
});

// Load Butterfly
gltfLoader.load('animated_butterfly.glb', (gltf) => {
  const model = gltf.scene;
  model.name = "Butterfly";
  model.position.set(0.73, 0.5, -0.064); // Position: 0.2, 0.4, -0.3
  model.scale.set(0.02, 0.02, 0.02); // Scale
  model.rotation.set(0, Math.PI / 4, 0);

  // Set initial opacity to 0
  model.visible = false; // Hide initially
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
  butterflyModel = model; // Store reference
  //   draggableObjects.push(model);

  if (gltf.animations.length > 0) {
    const mixer = new AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });
    mixers.push(mixer);
  }
});


// === 交互热点逻辑 ===
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
let hotspotGroup = new THREE.Group();
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
    container.userData = { ...data }; // Store data on container

    // 1. Visible Sphere (Small)
    // 缩小10倍: 0.05 -> 0.005
    const geometryVis = new THREE.SphereGeometry(0.005, 16, 16);
    const materialVis = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0, // Start invisible, fade in later
      depthTest: false,
      depthWrite: false
    });
    const meshVis = new THREE.Mesh(geometryVis, materialVis);
    meshVis.renderOrder = 999;
    container.add(meshVis);

    // 2. Hit Sphere (Larger, Invisible but interactable)
    // Radius 0.03 to expand interaction area without overlapping
    const geometryHit = new THREE.SphereGeometry(0.03, 16, 16);
    const materialHit = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0, // Fully transparent so it's invisible but still raycastable
      depthTest: false,
      depthWrite: false
    });
    const meshHit = new THREE.Mesh(geometryHit, materialHit);
    meshHit.renderOrder = 998;
    meshHit.userData = { parentGroup: container }; // Link back to container
    container.add(meshHit);

    hotspotGroup.add(container);
    interactables.push(meshHit); // Raycast against the larger hit sphere
  });
}
updateHotspots();

// === Glow Effect for Hotspots ===
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
glowSprite.renderOrder = 1000; // Ensure it renders on top of everything, similar to the hotspots
scene.add(glowSprite); // We'll move this to the active hotspot position

let hoveredHotspot = null;
let targetGlowOpacity = 0;

window.addEventListener('pointermove', (event) => {
  if (!uiFadedIn) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactables);

  // Check for Cat intersection (for cursor change)
  let isHoveringCat = false;
  if (catHitSphere) {
    const catIntersects = raycaster.intersectObject(catHitSphere, false);
    if (catIntersects.length > 0) {
      isHoveringCat = true;
    }
  }

  if (intersects.length > 0) {
    const hitObj = intersects[0].object;
    if (hoveredHotspot !== hitObj) {
      hoveredHotspot = hitObj;
      renderer.domElement.style.cursor = 'pointer';

      // Move glow sprite to this hotspot's position
      const container = hitObj.userData.parentGroup;
      glowSprite.position.copy(container.position);
      targetGlowOpacity = 0.8;
    }
  } else if (isHoveringCat) {
    renderer.domElement.style.cursor = 'pointer';
    // Clear hotspot glow if we move from hotspot to cat
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

// === 点击逻辑 ===
const mouseDownPos = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
  mouseDownPos.set(event.clientX, event.clientY);
});

window.addEventListener('pointerup', (event) => {
  // 计算移动距离判断是否为点击
  const moveDistance = Math.hypot(
    event.clientX - mouseDownPos.x,
    event.clientY - mouseDownPos.y
  );

  // 允许 5 像素的误差，超过则认为是拖拽
  const isClick = moveDistance < 5;

  if (!isClick) return; // 如果是拖拽操作，忽略

  // 如果点击的是对话框内部，忽略
  if (event.target.closest('#info-box')) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Note: Only raycast hotspots here. DragControls handles the model clicking separately.
  const intersects = raycaster.intersectObjects(interactables);

  // Check for Cat Click
  if (catHitSphere) {
    const catIntersects = raycaster.intersectObject(catHitSphere, false);
    if (catIntersects.length > 0) {
      playClickSound();
      openDocModal();
      return;
    }
  }

  if (intersects.length > 0) {
    const hitObj = intersects[0].object;
    const container = hitObj.userData.parentGroup;
    const data = container.userData;

    console.log("Clicked Hotspot Data:", data); // Debug: Check if audioId exists

    playClickSound(); // Play click sound

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
    // Trigger reflow to enable transition
    infoBox.offsetHeight;
    infoBox.style.opacity = '1';

    // Play Ambient Sound if defined
    if (data.audioId) {
      playAmbientSound(data.audioId, data.loop);
    }

  } else {
    // 点击空白处，关闭对话框
    playClickSound(); // Also play click sound on close? Optional.
    closeInfoBox();
  }
});

function closeInfoBox() {
  const infoBox = document.getElementById('info-box');
  if (infoBox && infoBox.style.display !== 'none') {
    infoBox.style.opacity = '0';

    stopAmbientSound(); // Fade out ambient sound

    setTimeout(() => {
      infoBox.style.display = 'none';
    }, 500); // Wait for transition (0.5s)
  }
}

const closeBtn = document.getElementById('close-btn');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    playClickSound();
    closeInfoBox();
  });
}

// === Documentation Modal Logic ===
const docModal = document.getElementById('doc-modal');
const closeDocBtn = document.getElementById('close-doc-btn');

function openDocModal() {
  if (docModal) {
    docModal.style.display = 'flex';
    // Trigger reflow
    docModal.offsetHeight;
    docModal.style.opacity = '1';

    // GSAP Animations
    if (window.gsap) {
      // Select elements inside the modal
      const title = docModal.querySelector('h2');
      const elements = docModal.querySelectorAll('h3, p, .image-gallery');

      // Reset state first (in case it was closed and reopened)
      window.gsap.set([title, ...elements], { opacity: 0, y: 20 });

      // Animate Main Title
      window.gsap.to(title, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        delay: 0.3
      });

      // Animate Content with Stagger
      window.gsap.to(elements, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.out",
        delay: 0.5
      });
    }
  }
}

function closeDocModal() {
  if (docModal) {
    docModal.style.opacity = '0';
    setTimeout(() => {
      docModal.style.display = 'none';
      // Optional: Reset for next open if not using GSAP set on open
    }, 500);
  }
}

if (closeDocBtn) {
  closeDocBtn.addEventListener('click', () => {
    playClickSound();
    closeDocModal();
  });
}

// Close doc modal when clicking outside content
if (docModal) {
  docModal.addEventListener('click', (e) => {
    if (e.target === docModal) {
      closeDocModal();
    }
  });
}

// Loading Elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// === Audio Setup ===
const bgMusic = document.getElementById('bg-music');
if (bgMusic) bgMusic.volume = 0.4; // Set initial volume

// Debug helper for all audio elements
document.querySelectorAll('audio').forEach(audio => {
  console.log(`Checking audio element: ${audio.id}, src: ${audio.querySelector('source')?.src}`);

  audio.addEventListener('canplaythrough', () => {
    console.log(`Audio loaded and ready: ${audio.id}`);
  });

  audio.addEventListener('error', (e) => {
    console.error(`Error loading audio ${audio.id}:`, e);
    // Check the source error
    const src = audio.querySelector('source');
    if (src) console.error(`Source error for ${audio.id}:`, src.src);
  }, true);

  // Check initial state
  if (audio.error) {
    console.error(`Audio ${audio.id} already has error:`, audio.error);
  }
});

const sfxClick = document.getElementById('sfx-click');
let currentAmbientSound = null; // Track currently playing ambient sound

function playClickSound() {
  if (!sfxClick) return;
  // Reset and play click sound
  sfxClick.currentTime = 0;
  sfxClick.volume = 0.6;
  sfxClick.play().catch(() => { });
}

function playAmbientSound(audioId, isLoop) {
  // Stop previous if any
  stopAmbientSound();

  const audio = document.getElementById(audioId);
  if (!audio) return;

  currentAmbientSound = audio;
  audio.loop = isLoop;
  audio.currentTime = 0;
  audio.volume = 1.0; // Play immediately at full volume

  console.log(`Attempting to play: ${audioId}, src: ${audio.querySelector('source').src}`);

  audio.play()
    .then(() => console.log(`Playing: ${audioId}`))
    .catch(e => console.error("Audio play error:", e));
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

  // Create a user interaction handler that we can use for both click and keydown
  const playOnInteraction = () => {
    bgMusic.play()
      .then(() => {
        console.log("Audio started successfully on user interaction.");
        window.removeEventListener('click', playOnInteraction);
        window.removeEventListener('keydown', playOnInteraction);
        window.removeEventListener('touchstart', playOnInteraction);
      })
      .catch(e => console.log("Still blocked, waiting for next interaction...", e));
  };

  // Attempt auto-play first
  bgMusic.play()
    .then(() => {
      console.log("Auto-play successful!");
    })
    .catch(e => {
      console.log("Auto-play prevented. Waiting for user interaction.", e);
      // Listen for multiple types of interactions
      window.addEventListener('click', playOnInteraction);
      window.addEventListener('keydown', playOnInteraction);
      window.addEventListener('touchstart', playOnInteraction);
    });
}

// Try to play immediately on page load
tryPlayMusic();

// === 加载模型逻辑 ===
async function loadSplat(urlOrBuffer, isBuffer = false) {
  // Start Music when loading starts (Redundant if played above, but safe)
  // tryPlayMusic(); 

  // Show Loading
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

    // === 调整坐标系 ===
    // 许多 3DGS 文件是倒置的，这里设置默认不翻转，或者根据需要调整
    // 之前是 splatMesh.quaternion.set(1, 0, 0, 0); 这实际上是一个 180度翻转
    // 现在改为 Identity (不旋转)，如果是倒的，可以手动改回 set(1, 0, 0, 0)
    splatMesh.quaternion.set(0, 0, 0, 1);
    // 如果发现模型是倒的，解开下面这行注释：
    // splatMesh.quaternion.set(1, 0, 0, 0);

    splatMesh.position.set(0, 0, 0);
    splatMesh.scale.set(1, 1, 1);

    scene.add(splatMesh);

    await splatMesh.loaded;

    splatLoaded = true;
    baseTime = 0; // Start animation from 0s (wait for music/reveal)
    setupSplatModifier();

  } catch (e) {
    console.error("Load error:", e);
    if (loadingText) loadingText.innerText = "Error"; // Simplified error text
  }
}

// === 特效 Shader 逻辑 ===
function setupSplatModifier() {
  if (!splatMesh) return;

  // dyno.dynoBlock: 定义一个动态 Shader 块
  // 它接收一个 gsplat 输入，并输出修改后的 gsplat
  splatMesh.objectModifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat }, // 输入类型
    { gsplat: dyno.Gsplat }, // 输出类型
    ({ gsplat }) => {
      // 创建一个新的 Dyno 实例，用于封装 GLSL 代码
      const d = new dyno.Dyno({
        inTypes: { gsplat: dyno.Gsplat, t: "float", effectType: "int" },
        outTypes: { gsplat: dyno.Gsplat },
        // 定义全局 GLSL 函数 (hash, noise, rot)
        globals: () => [
          dyno.unindent(`
          // 哈希函数：生成伪随机数
          vec3 hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(vec3(p.x * p.y * p.z, p.x + p.y * p.z, p.x * p.y + p.z));
          }
          // 噪声函数：基于哈希生成平滑的噪声值
          vec3 noise(vec3 p) {
            vec3 i = floor(p); vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                           mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                           mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
          }
          // 旋转矩阵：用于旋转坐标
          mat2 rot(float a) { float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
        `)
        ],
        // 主要的 Shader 逻辑
        statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat}; // 初始化输出为输入
        float t = ${inputs.t}; // 时间变量
        
        // 计算一个随时间变化的平滑步进值 s，用于控制特效的扩散范围
        float s = smoothstep(0.,25.,t-4.5)*10.;
        
        vec3 scales = ${inputs.gsplat}.scales; // 获取原始缩放
        vec3 localPos = ${inputs.gsplat}.center; // 获取原始位置
        float l = length(localPos.xz); // 计算当前点到中心轴(Y轴)的水平距离
        
        // 根据 effectType 选择不同的特效逻辑
        if (${inputs.effectType} == 1) { // Magic (魔术特效)
          // border: 计算当前点是否在扩散边缘
          float border = abs(s-l-.5);
          // 稍微扭曲位置
          localPos *= 1.-.2*exp(-20.*border);
          // finalScales: 混合原始缩放和极小缩放(隐藏)，实现消失/出现效果
          vec3 finalScales = mix(scales,vec3(0.002),smoothstep(s-.5,s,l+.5));
          // 更新中心位置：加上噪声扰动
          ${outputs.gsplat}.center = localPos + .1*noise(localPos.xyz*2.+t*.5)*smoothstep(s-.5,s,l+.5);
          // 更新缩放
          ${outputs.gsplat}.scales = finalScales;
          // 计算角度
          float at = atan(localPos.x,localPos.z)/3.1416;
          // 根据角度和时间裁剪颜色 (rgba *= step(...))
          ${outputs.gsplat}.rgba *= step(at,t-3.1416);
          // 增加发光边缘
          ${outputs.gsplat}.rgba += exp(-20.*border) + exp(-50.*abs(t-at-3.1416))*.5;
        } else if (${inputs.effectType} == 2) { // Spread
           float tt = t*t*.4+.5;
           localPos.xz *= min(1.,.3+max(0.,tt*.05));
           ${outputs.gsplat}.center = localPos;
           ${outputs.gsplat}.scales = max(mix(vec3(0.0),scales,min(tt-7.-l*2.5,1.)),mix(vec3(0.0),scales*.2,min(tt-1.-l*2.,1.)));
           ${outputs.gsplat}.rgba = mix(vec4(.3),${inputs.gsplat}.rgba,clamp(tt-l*2.5-3.,0.,1.));
        } else if (${inputs.effectType} == 3) { // Unroll
           localPos.xz *= rot((localPos.y*50.-20.)*exp(-t));
           ${outputs.gsplat}.center = localPos * (1.-exp(-t)*2.);
           ${outputs.gsplat}.scales = mix(vec3(0.002),scales,smoothstep(.3,.7,t+localPos.y-2.));
           ${outputs.gsplat}.rgba = ${inputs.gsplat}.rgba*step(0.,t*.5+localPos.y-.5);
        }
      `),
      });

      // 获取当前选择的特效类型 (1: Magic, 2: Spread, 3: Unroll)
      const effectType = effectParams.effect === "Magic" ? 1 :
        effectParams.effect === "Spread" ? 2 : 3;

      // 应用 Dyno 逻辑，传入参数
      gsplat = d.apply({
        gsplat,
        t: animateT, // 传入时间变量，这个变量在 animationLoop 中不断增加
        effectType: dyno.dynoInt(effectType)
      }).gsplat;

      return { gsplat };
    });
  splatMesh.updateGenerator(); // 更新 Shader
}

// === Viewpoints Logic ===
const viewpoints = {
  'Default': { pos: [0.01, 0.71, 0.68], target: null }, // Target set on init
  'Top Down': { pos: [0, 3, 0], target: [0, 0, 0] },
  'Front': { pos: [0, 0, 3], target: [0, 0, 0] }
};

// Update Default target after calculation above
viewpoints['Default'].target = target.toArray();

const viewpointParams = {
  currentView: 'Default',
  saveToConsole: () => {
    const pos = camera.position.toArray().map(v => Number(v.toFixed(3)));
    const target = controls.target.toArray().map(v => Number(v.toFixed(3)));
    const rot = [
      THREE.MathUtils.radToDeg(camera.rotation.x),
      THREE.MathUtils.radToDeg(camera.rotation.y),
      THREE.MathUtils.radToDeg(camera.rotation.z)
    ].map(v => Number(v.toFixed(1)));

    console.log(`Position: [${pos.join(', ')}]`);
    console.log(`Target: [${target.join(', ')}]`);
    console.log(`Rotation (Deg): [${rot.join(', ')}]`);
    alert(`Check Console (F12) for view data!\nPos: ${pos}\nTarget: ${target}`);
  }
};

function setViewpoint(name) {
  if (viewpoints[name]) {
    const v = viewpoints[name];
    // Smooth transition could be added here, but direct set for now
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    controls.update();
  }
}

// === 拖拽上传逻辑 ===
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

// === 启动 ===
// Load 'testing.ply' from root (public folder)
fetch('testing.ply', { method: 'HEAD' })
  .then(res => {
    if (res.ok) loadSplat('testing.ply');
    else {
      console.warn("testing.ply not found, loading example model...");
      loadSplat('https://sparkjs.dev/examples/assets/splats/primerib-tamos.spz');
    }
  })
  .catch(() => loadSplat('https://sparkjs.dev/examples/assets/splats/primerib-tamos.spz'));

// 渲染循环
const coordsDisplay = document.getElementById('coords-display');
let uiFadedIn = false;

renderer.setAnimationLoop((time) => {
  updateCameraMovement(); // Update WASD movement

  // Update Animation Mixers (Cat & Butterfly)
  const delta = clock.getDelta();
  mixers.forEach(mixer => mixer.update(delta));

  if (splatLoaded) {
    baseTime += 1 / 60;
    animateT.value = baseTime;

    // Fade OUT Loading Overlay smoothly when animation starts
    // Start fading at 4.5s
    if (baseTime > 4.5) {
      if (loadingOverlay && loadingOverlay.style.opacity !== '0' && loadingOverlay.style.display !== 'none') {
        // Calculate opacity: starts at 1.0 at t=4.5, reaches 0 at t=8.5 (4s fade)
        const fadeDuration = 4.0;
        const opacity = Math.max(0, 1.0 - (baseTime - 4.5) / fadeDuration);
        loadingOverlay.style.opacity = opacity.toString();

        // Only hide when TRULY zero
        if (opacity <= 0.001) { // Use a small epsilon
          loadingOverlay.style.opacity = '0'; // Ensure it's 0
          loadingOverlay.style.pointerEvents = 'none';
          setTimeout(() => { // Optional: delay removal slightly to be safe
            loadingOverlay.style.display = 'none';
          }, 100);
        }
      }
    }

    // Fade in UI and Hotspots when reveal effect is mature (t > 7.0)
    if (baseTime > 10.0) {
      if (!uiFadedIn) {
        // 1. Fade in HTML elements
        if (document.getElementById('site-title')) document.getElementById('site-title').style.opacity = '1';
        if (document.getElementById('coords-display')) document.getElementById('coords-display').style.opacity = '1';
        if (document.getElementById('upload-hint')) document.getElementById('upload-hint').style.opacity = '1';
        uiFadedIn = true;
      }

      // 2. Fade in Hotspots (Three.js objects)
      // Iterate through all visible spheres and increase opacity to 1.0
      hotspotGroup.children.forEach(container => {
        // The visible mesh is the first child (index 0) based on updateHotspots logic
        const visMesh = container.children[0];
        if (visMesh && visMesh.material.opacity < 1.0) {
          visMesh.material.opacity += 0.01; // Fade speed
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

  // Update glow opacity
  if (uiFadedIn) {
    glowMaterial.opacity += (targetGlowOpacity - glowMaterial.opacity) * 0.1;
    glowSprite.visible = glowMaterial.opacity > 0.01;
  }

  // 更新坐标显示
  if (coordsDisplay) {
    // If NOT dragging, show Camera Pos. If dragging, DragControls handles it.
    // if (!renderer.domElement.style.cursor.includes('pointer') && controls.enabled) {
    const { x, y, z } = camera.position;
    const rotX = THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(1);
    const rotY = THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(1);
    const rotZ = THREE.MathUtils.radToDeg(camera.rotation.z).toFixed(1);

    coordsDisplay.innerHTML = `
            Pos: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}<br>
            Rot: ${rotX}°, ${rotY}°, ${rotZ}°
        `;
    // }
  }

  renderer.render(scene, camera);
});