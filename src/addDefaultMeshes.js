import * as Three from 'three'

export const addDefaultMeshes = ({ xPoz = 0, yPoz = 0, zPoz = 0 } = {}) => {
    const geometry = new Three.BoxGeometry()
    const material = new Three.MeshBasicMaterial({ color: '#ffffff' })
    const mesh = new Three.Mesh(geometry, material)
    mesh.position.set(xPoz, yPoz, zPoz)
    return mesh
}

export const addStandardMeshes = ({ xPoz = 0, yPoz = 0, zPoz = 0 } = {}) => {
    const geometry = new Three.BoxGeometry(1, 1, 1)
    const material = new Three.MeshStandardMaterial({ color: '#ffffff' })
    const mesh = new Three.Mesh(geometry, material)
    mesh.position.set(xPoz, yPoz, zPoz)
    return mesh
}