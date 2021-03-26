import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class AdlerModel {
    constructor(scene) {
        this.GLTFLoader = new GLTFLoader()

        this.scene = scene
        this.createMaterials()
        this.loadFloorModel()

        this.collidableMeshList = []
        this.floorModelParts = []
        //this.coverElevatorBankArea();
    }

    getCollidableMeshList() {
        return this.collidableMeshList
    }
    // this method instantiates materials for various parts of the ITP floor model
    // wall, ceiling, floor
    createMaterials() {
        this.testMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a })

        // wall material:
        this.wallMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffe6,
        })

        // ceiling material
        this.ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff })

        // floor material
        // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_variations_phong.html
        let floorTexture = new THREE.TextureLoader().load(require('../assets/images/textures/floor.jpg'))
        floorTexture.wrapS = THREE.RepeatWrapping
        floorTexture.wrapT = THREE.RepeatWrapping
        floorTexture.repeat.set(1, 1)

        this.floorMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: floorTexture,
        })

        this.paintedMetalMaterial = new THREE.MeshLambertMaterial({
            color: 0x1a1a1a,
            flatShading: true,
        })

        this.windowShelfMaterial = new THREE.MeshLambertMaterial({
            color: 0x565656,
        })

        // https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_physical_transparency.html
        this.glassMaterial = new THREE.MeshLambertMaterial({
            color: 0xd9ecff,
            transparent: true,
            opacity: 0.25,
        })

        this.lightHousingMaterial = new THREE.MeshLambertMaterial({
            color: 0x111111,
        })

        this.lightDiffuserMaterial = new THREE.MeshLambertMaterial({
            color: 0xcccccc,
        })

        this.glassFixturingMaterial = new THREE.MeshLambertMaterial({
            color: 0x000000,
        })
        this.graniteBarMaterial = new THREE.MeshLambertMaterial({
            color: 0x000000,
        })
    }

    loadModel(_file, _name, _material, _scale, _castShadow, _receiveShadow, _collidable = false) {
        this.GLTFLoader.load(
            _file,
            (gltf) => {
                let scene = gltf.scene
                scene.position.set(0, 0, 0)
                scene.scale.set(_scale, _scale, _scale)
                scene.traverse((child) => {
                    if (child.isMesh) {
                        child.material = _material
                        child.castShadow = _castShadow
                        child.receiveShadow = _receiveShadow
                        if (_collidable) {
                            child.layers.enable(3)

                            this.collidableMeshList.push(child)
                        }
                    }
                })
                this.scene.add(scene)
                scene.name = _name
                this.floorModelParts.push(scene)
            },
            undefined,
            function (e) {
                console.log('trying to load',_file);
                console.error(e)
            }
        )
    }

    coverElevatorBankArea() {
        let boxGeo = new THREE.BoxBufferGeometry(24.75,5,0.1);
        let leftSideCover = new THREE.Mesh(boxGeo, this.wallMaterial);
        leftSideCover.position.set(16,2,-4.1);

        let rightSideCover = new THREE.Mesh(boxGeo, this.wallMaterial);
        rightSideCover.position.set(14.65,2,2.25);
        this.scene.add(leftSideCover)
        this.scene.add(rightSideCover);

        leftSideCover.layers.enable(3)
        rightSideCover.layers.enable(3)
    }

    loadFloorModel() {
        let scaleFactor = 1
        this.matMode = 0

        //this.loadModel(require('../assets/models/rehearsal/ceiling.glb'), "ceiling", this.ceilingMaterial, scaleFactor, false, false)
        this.loadModel(require('../assets/models/rehearsal/floor.glb'), "floor", this.floorMaterial, scaleFactor, false, true, true)
        this.loadModel(require('../assets/models/rehearsal/walls.glb'), "walls", this.wallMaterial, scaleFactor, true, true, true)
        //this.loadModel(require('../assets/models/itp/glass-fixturing.glb'), "glass-fixturing", this.glassFixturingMaterial, scaleFactor, true, false)
        //this.loadModel(require('../assets/models/itp/glass.glb'), "glass", this.glassMaterial, scaleFactor, false, false, true)
        //this.loadModel(require('../assets/models/itp/granite-bar.glb'), "granite-bar", this.graniteBarMaterial, scaleFactor, true, false, true)
        //this.loadModel(require('../assets/models/itp/ibeam.glb'), "ibeam", this.paintedMetalMaterial, scaleFactor, true, false, true)
        // this.loadModel(require('../assets/models/itp/light-diffuser.glb'), "light-diffuser", this.lightDiffuserMaterial, scaleFactor, false, false);
        // this.loadModel(require('../assets/models/itp/light-housing.glb'), "light-housing", this.lightHousingMaterial, scaleFactor, false, false);
        // this.loadModel(require('../assets/models/itp/lighting-grid.glb'), "lighting-grid", this.wallMaterial, scaleFactor, false, false);
        //this.loadModel(require('../assets/models/itp/window-shelf.glb'), "window-shelf", this.windowShelfMaterial, scaleFactor, true, false)
        //this.loadModel(require('../assets/models/itp/wooden-bar.glb'), "wooden-bar", this.floorMaterial, scaleFactor, true, true, true)
    }

    swapMaterials() {
        this.matMode++
        if (this.matMode >= 3) {
            this.matMode = 0
        }
        switch (this.matMode) {
            case 0:
                for (let i = 0; i < this.floorModelParts.length; i++) {
                    let scene = this.floorModelParts[i]
                    let mat = this.getMatFromName(scene.name)
                    scene.traverse((child) => {
                        if (child.isMesh) {
                            child.material = mat
                        }
                    })
                }
                break

            case 1:
                for (let i = 0; i < this.floorModelParts.length; i++) {
                    let scene = this.floorModelParts[i]
                    if (scene.name == 'floor' || scene.name == 'glass') {
                        continue
                    } else {
                        scene.traverse((child) => {
                            if (child.isMesh) {
                                // https://stackoverflow.com/questions/43088424/setting-random-color-for-each-face-in-threejs-results-in-black-object
                                let col = new THREE.Color(0xffffff)
                                col.setHex(Math.random() * 0xffffff)
                                let mat = new THREE.MeshLambertMaterial({ color: col })
                                child.material = mat
                            }
                        })
                    }
                }
                break

            case 2:
                for (let i = 0; i < this.floorModelParts.length; i++) {
                    let scene = this.floorModelParts[i]
                    if (scene.name == 'floor' || scene.name == 'glass') {
                        continue
                    } else {
                        scene.traverse((child) => {
                            if (child.isMesh) {
                                // https://stackoverflow.com/questions/43088424/setting-random-color-for-each-face-in-threejs-results-in-black-object
                                let col = new THREE.Color(0xffffff)
                                col.setHex(Math.random() * 0xffffff)
                                let mat = new THREE.MeshPhongMaterial({
                                    color: col,
                                    reflectivity: 0.4,
                                    shininess: 1,
                                })
                                child.material = mat
                            }
                        })
                    }
                }
                break
        }
    }

    getMatFromName(name) {
        let mat = null
        switch (name) {
            case 'ceiling':
                mat = this.ceilingMaterial
                break
            case 'floor':
                mat = this.floorMaterial
                break
            case 'glass-fixturing':
                mat = this.glassFixturingMaterial
                break
            case 'glass':
                mat = this.glassMaterial
                break
            case 'granite-bar':
                mat = this.graniteBarMaterial
                break
            case 'ibeam':
                mat = this.paintedMetalMaterial
                break
            case 'light-diffuser':
                mat = this.lightDiffuserMaterial
                break
            case 'light-housing':
                mat = this.lightHousingMaterial
                break
            case 'lighting-grid':
                mat = this.wallMaterial
                break
            case 'walls':
                mat = this.wallMaterial
                break
            case 'window-shelf':
                mat = this.windowShelfMaterial
                break
            case 'wooden-bar':
                mat = this.floorMaterial
                break
        }

        return mat
    }
}
