import * as Three from 'three'

export const addDefaultMeshes = () => {

    const geometry = new Three.BoxGeometry()
    const material = new Three.MeshBasicMaterial({ color: 0x00ff00 })
    const mesh = new Three.Mesh(geometry, material)
    return mesh

}