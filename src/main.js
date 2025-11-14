import './style.css'
import * as THREE from 'three'
import { addDefaultMeshes, addStandardMeshes } from './addDefaultMeshes'
import { addLight } from './addLight'
import Model from './model'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 0, 5)
const renderer = new THREE.WebGLRenderer({ antialias: true })
const meshes = {}
const lights = {}
const mixers = []
const clock = new THREE.Clock()
init()

function init() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  //add our meshes into our container then add to scene
  meshes.default = addDefaultMeshes({ xPoz: -2 })
  meshes.standard = addStandardMeshes({ xPoz: 2 })
  lights.dafault = addLight()

  //add to scene
  scene.add(meshes.default)
  scene.add(meshes.standard)
  scene.add(lights.dafault)

  instances()
  animate()
}

function instances() {
  const flowers = new Model({
    url: 'flowers.glb',
    name: 'flower',
    scene: scene,
    meshes: meshes,
    scale: new THREE.Vector3(2, 2, 2),
    position: new THREE.Vector3(0, -0.8, 3),
    animationState: true,
    mixers: mixers,
  })
  flowers.init()
}

function animate() {
  const delta = clock.getDelta()
  for (const mixer of mixers) {
    mixer.update(delta)
  }
  meshes.standard.rotation.x += 0.01
  meshes.standard.rotation.y += 0.01
  meshes.default.rotation.x += 0.01
  meshes.default.rotation.y += 0.01
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}