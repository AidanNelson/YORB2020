import * as THREE from 'three'

// assuming your images are in a folder called 'photoGallery' and are jpgs
const photos = require('../assets/images/photoGallery/*.jpg')

export class PhotoGallery {
    constructor(scene) {
        this.scene = scene
        this.textureLoader = new THREE.TextureLoader()
        this.addImages()
    }

    addImages() {
        let startIndex = 0
        let endIndex = 12
        for (let i = startIndex; i < endIndex; i++) {
            let fileName = i

            let mesh = this.makeImageMesh(fileName)
            if (mesh) {
                let yOffset = 0.5
                if (i % 2 == 0) {
                    yOffset = -0.5
                }
                let locX = -14
                let offset = i - startIndex * 1
                let locZ = -30 + offset
                // place the mesh
                mesh.position.set(locX, 1.5 + yOffset, locZ)
                mesh.rotateY(Math.PI / 2)
                this.scene.add(mesh)
            }
        }

        startIndex = endIndex
        endIndex = endIndex + 5
        for (let i = startIndex; i < endIndex; i++) {
            let fileName = i

            let mesh = this.makeImageMesh(fileName)
            if (mesh) {
                let yOffset = 0.5
                if (i % 2 == 0) {
                    yOffset = -0.5
                }
                let locX = -14
                let offset = i - startIndex * 1
                let locZ = -42.75 + offset
                // place the mesh
                mesh.position.set(locX, 1.5 + yOffset, locZ)
                mesh.rotateY(Math.PI / 2)
                this.scene.add(mesh)
            }
        }

        startIndex = endIndex
        endIndex = endIndex + 9
        for (let i = startIndex; i < endIndex; i++) {
            let fileName = i

            let mesh = this.makeImageMesh(fileName)
            if (mesh) {
                let yOffset = 0.5
                if (i % 2 == 0) {
                    yOffset = -0.5
                }
                let locX = -7
                let offset = i - startIndex * 1
                let locZ = -57 + offset
                // place the mesh
                mesh.position.set(locX, 1.5 + yOffset, locZ)
                mesh.rotateY(Math.PI / 2)
                this.scene.add(mesh)
            }
        }

        startIndex = endIndex
        endIndex = endIndex + 17
        for (let i = startIndex; i < endIndex; i++) {
            let fileName = i

            let mesh = this.makeImageMesh(fileName)
            if (mesh) {
                let yOffset = 0.5
                if (i % 2 == 0) {
                    yOffset = -0.5
                }
                let locX = -7
                let offset = i - startIndex * 1
                let locZ = -77 + offset
                // place the mesh
                mesh.position.set(locX, 1.5 + yOffset, locZ)
                mesh.rotateY(Math.PI / 2)
                this.scene.add(mesh)
            }
        }

        startIndex = endIndex
        endIndex = endIndex + 11
        for (let i = startIndex; i < endIndex; i++) {
            let fileName = i

            let mesh = this.makeImageMesh(fileName)
            if (mesh) {
                let yOffset = 0.5
                if (i % 2 == 0) {
                    yOffset = -0.5
                }
                let locX = -23.55
                let offset = i - startIndex * 1
                let locZ = -93 + offset
                // place the mesh
                mesh.position.set(locX, 1.5 + yOffset, locZ)
                mesh.rotateY(Math.PI / 2)
                this.scene.add(mesh)
            }
        }

        startIndex = endIndex
        endIndex = endIndex + 11
        for (let i = startIndex; i < endIndex; i++) {
            let fileName = i

            let mesh = this.makeImageMesh(fileName)
            if (mesh) {
                let yOffset = 0.5
                if (i % 2 == 0) {
                    yOffset = -0.5
                }
                let locX = -17.25
                let offset = i - startIndex * 1
                let locZ = -93 + offset
                // place the mesh
                mesh.position.set(locX, 1.5 + yOffset, locZ)
                mesh.rotateY(Math.PI / 2)
                this.scene.add(mesh)
            }
        }

        // startIndex = endIndex
        // endIndex = endIndex + 11
        // for (let i = startIndex; i < endIndex; i++) {
        //     let proj = uniqueProjects[i]
        //     let locX = -16
        //     let offset = i - startIndex * 1
        //     let locZ = -93 + offset
        //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
        //     // hyperlink.rotateY(Math.PI);
        //     this.hyperlinkedObjects.push(hyperlink)
        //     this.scene.add(hyperlink)
        // }

        // startIndex = endIndex
        // endIndex = endIndex + 11
        // for (let i = startIndex; i < endIndex; i++) {
        //     let proj = uniqueProjects[i]
        //     let locX = -23.55
        //     let offset = i - startIndex * 1
        //     let locZ = -106 + offset
        //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
        //     // hyperlink.rotateY(Math.PI);
        //     this.hyperlinkedObjects.push(hyperlink)
        //     this.scene.add(hyperlink)
        // }

        // startIndex = endIndex
        // endIndex = endIndex + 8
        // for (let i = startIndex; i < endIndex; i++) {
        //     let proj = uniqueProjects[i]
        //     let locX = 1.25
        //     let offset = i - startIndex * 1
        //     let locZ = -106 + offset
        //     let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
        //     hyperlink.rotateY(Math.PI)
        //     this.hyperlinkedObjects.push(hyperlink)
        //     this.scene.add(hyperlink)
        // }
    }

    makeImageMesh(imageName) {
        if (photos[imageName]) {
            let geo = new THREE.BoxBufferGeometry(1.6, 0.9, 0.01)

            let tex = this.textureLoader.load(photos[imageName])
            tex.wrapS = THREE.RepeatWrapping
            tex.wrapT = THREE.RepeatWrapping
            tex.repeat.set(1, 1)

            let imageMat = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                map: tex,
            })

            let mesh = new THREE.Mesh(geo, imageMat)
            return mesh
        }
        return false
    }
}
