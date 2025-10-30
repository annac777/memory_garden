import * as THREE from 'three'
import { addDefaultMeshes } from './addDefaultMeshes'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 0, 5)
const renderer = new THREE.WebGLRenderer({ antialias: true })
const mesh = {}
init()

function init() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  //add our meshes into our container then add to scene
  mesh.default = addDefaultMeshes()
  mesh.copy = addDefaultMeshes()

  mesh.copy.position.x = 2

  //add to scene
  scene.add(mesh.default)
  scene.add(mesh.copy)

  animate()
}

function animate() {
  mesh.default.position.x += 0.01
  mesh.default.scale.x += 0.01
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}



