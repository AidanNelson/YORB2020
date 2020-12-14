import * as THREE from 'three'
import { projects } from '.'
import { create3DText, createSimpleText } from './utils'
import { Portal } from './portals'
import { Vector3 } from 'three'

const project_thumbnails = require('../assets/images/project_thumbnails/*.png')

// set which YORBLET we're in
const YORBLET_INDEX = 1

// pick colors
const OUTER_FENCE_COLOR = 0x232378
const ENTRANCE_COLOR = 0xf9f910
const STAGE_COLOR = 0x232323
const DOME_COLOR = 0x232323
const PROJECT_NUMBER_COLOR = 0x123456;

// other parameters:
const NUMBER_OF_PROJECTS = 10
const RADIUS = 30
const FENCE_RADIUS = RADIUS + 10
const FENCE_HEIGHT = 12

export class Yorblet {
    constructor(scene, projectionScreenManager, mouse, camera, portalModel, url, portalLabel) {
        this.scene = scene
        this.mouse = mouse;
        this.camera = camera;
        this.projectionScreenManager = projectionScreenManager

        //
        this.numProjects = NUMBER_OF_PROJECTS

        // we need some stuff to operate:
        this.raycaster = new THREE.Raycaster()
        this.textureLoader = new THREE.TextureLoader()
        this.textParser = new DOMParser()

        // materials for the project podiums
        this.highlightMaterial = new THREE.MeshLambertMaterial({ color: 0xffff1a })
        this.linkMaterial = new THREE.MeshLambertMaterial({ color: 0xb3b3ff })
        this.linkVisitedMaterial = new THREE.MeshLambertMaterial({
            color: 0x6699ff,
        })
        this.statusBoxMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 })

        //
        this.projects = []
        this.hyperlinkedObjects = []
        this.linkMaterials = {}

        window.addEventListener('click', (e) => this.onMouseClick(e), false)

        // finally, call the setup function:
        this.setup()

        //putting portal here so can call the checkTeleport function
        this.portalModel = portalModel; //lobby and yorblet share same portal instead of having lobby portal and yorblet portal
        this.url = url; //url of this yorblet server -- for lobby to reference
        this.portal = new Portal(this.scene, {model: this.portalModel, position: new Vector3(0, 0, 10)}, 'https://yorb.itp.io/experimental', portalLabel);
    }

    setup() {
        //
        var loader = new THREE.FontLoader()
        let fontJSON = require('../assets/fonts/helvetiker_bold.json')
        this.font = loader.parse(fontJSON)
        this._updateProjects()

        this.addFloor()
        this.addCenterPiece()
        this.addOuterDecoration()

        // first create the exterior walls of the space
        this.createYorbletExterior()

        // then the stages and styling fo those stages
        this.createYorbletStages()

        // then add the individual project posters
        this.createProjectPodiums()

    }

    createYorbletExterior() {
        let fenceRadius = FENCE_RADIUS
        // add entrance:
        const geometry = new THREE.TorusBufferGeometry(12, 2, 16, 24, Math.PI)
        const material = new THREE.MeshBasicMaterial({ color: ENTRANCE_COLOR })
        const torus = new THREE.Mesh(geometry, material)
        this.scene.add(torus)
        torus.position.set(fenceRadius, 0, 0)
        torus.lookAt(0, 0, 0)

        //backside fence
        let fenceGeo = new THREE.BoxBufferGeometry(50, FENCE_HEIGHT, 0.1)
        let fenceMat = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        let fenceMesh = new THREE.Mesh(fenceGeo, fenceMat)
        this.scene.add(fenceMesh)
        fenceMesh.position.set(-fenceRadius, 0, 0)
        fenceMesh.rotateY(Math.PI / 2)

        // side of entrance fences
        fenceGeo = new THREE.BoxBufferGeometry(20, FENCE_HEIGHT, 0.1)
        fenceMat = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        fenceMesh = new THREE.Mesh(fenceGeo, fenceMat)
        this.scene.add(fenceMesh)
        fenceMesh.position.set(fenceRadius, 0, 20)
        fenceMesh.rotateY(Math.PI / 2)

        // side of entrance fences
        fenceGeo = new THREE.BoxBufferGeometry(20, FENCE_HEIGHT, 0.1)
        fenceMat = new THREE.MeshBasicMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        fenceMesh = new THREE.Mesh(fenceGeo, fenceMat)
        this.scene.add(fenceMesh)
        fenceMesh.position.set(fenceRadius, 0, -20)
        fenceMesh.rotateY(Math.PI / 2)

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        // add left fence:
        let cylinderGeometry = new THREE.CylinderBufferGeometry(fenceRadius, fenceRadius, FENCE_HEIGHT, 32, 1, true, 0, Math.PI)
        let cylinderMaterial = new THREE.MeshPhongMaterial({ color: OUTER_FENCE_COLOR, side: THREE.DoubleSide })
        let cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(xOffset, 0, zOffset)
        cylinder.rotateY((-Math.PI * 1) / 2)
        this.scene.add(cylinder)

        xOffset = 0
        zOffset = -20

        // add right side fence
        cylinderGeometry = new THREE.CylinderBufferGeometry(fenceRadius, fenceRadius, FENCE_HEIGHT, 32, 1, true, 0, Math.PI)
        cylinderMaterial = new THREE.MeshPhongMaterial({ color: 0x232378, side: THREE.DoubleSide })
        cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(xOffset, 0, zOffset)
        cylinder.rotateY((Math.PI * 1) / 2)
        this.scene.add(cylinder)
    }

    createYorbletStages() {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 1
        // make left side projects
        for (let i = 0; i < this.numProjects / 2; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            this.addPresentationStage(projectIndex, centerX, centerZ, xOffset, zOffset, 1, angle)
            projectIndex++
        }

        xOffset = 0
        zOffset = -20

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < this.numProjects - 1; i++) {
            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset
            this.addPresentationStage(projectIndex, centerX, centerZ, xOffset, zOffset, 1, angle)
            projectIndex++
        }
    }

    // this will update the project posters
    createProjectPodiums() {
        let radius = RADIUS

        // set left side offsets
        let xOffset = 0
        let zOffset = 20

        let projectIndex = 0
        // make left side projects
        for (let i = 0; i < this.numProjects / 2; i++) {
            let proj = this.projects[projectIndex]
            if (!proj) return

            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset

            let hyperlink = this.createHyperlinkedMesh(centerX, 1, centerZ, xOffset, zOffset, proj)
            this.hyperlinkedObjects.push(hyperlink)
            this.scene.add(hyperlink)

            projectIndex++
        }

        xOffset = 0
        zOffset = -20

        // make right side projects
        for (let i = this.numProjects / 2 - 1; i < this.numProjects - 1; i++) {
            let proj = this.projects[projectIndex]
            if (!proj) return

            let theta = (Math.PI * 2) / (this.numProjects - 2)
            let angle = theta * i

            let centerX = radius * Math.cos(angle) + xOffset
            let centerZ = radius * Math.sin(angle) + zOffset

            let hyperlink = this.createHyperlinkedMesh(centerX, 1, centerZ, xOffset, zOffset, proj)
            this.hyperlinkedObjects.push(hyperlink)
            this.scene.add(hyperlink)

            projectIndex++
        }
    }

    addPresentationStage(projectIndex, centerX, centerZ, lookAtX, lookAtZ, scaleFactor = 1, angle) {
        // add the stage itself
        const cylinderGeometry = new THREE.CylinderBufferGeometry(3 * scaleFactor, 3 * scaleFactor, 1, 32, 1, false)
        const cylinderMaterial = new THREE.MeshPhongMaterial({ color: STAGE_COLOR, side: THREE.DoubleSide })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(centerX, 0, centerZ)
        this.scene.add(cylinder)

        // style the area according to which YORBLET we are in

        if (YORBLET_INDEX === 1) {
            // do styling for yorblet 1
            this.addCircleFence(centerX, centerZ, lookAtX, lookAtZ, angle)
        } else if (YORBLET_INDEX === 2) {
            // do styling for yorblet 2
            this.addRectFence(centerX, centerZ, lookAtX, lookAtZ, angle)
        } else if (YORBLET_INDEX === 3) {
            // do styling for yorblet 3
            this.addTriFence(centerX, centerZ, lookAtX, lookAtZ, angle)
        } else if (YORBLET_INDEX === 4) {
            // do styling for yorblet 4
        } else if (YORBLET_INDEX === 5) {
            // do styling for yorblet 5
        } else if (YORBLET_INDEX === 6) {
            // do styling for yorblet 6
        } else if (YORBLET_INDEX === 7) {
            // do styling for yorblet 7
        } else if (YORBLET_INDEX === 8) {
            // do styling for yorblet 8
        }

        // making a mini dome
        //https://threejsfundamentals.org/threejs/lessons/threejs-primitives.html
        //trying sphereGeometryconst radius = 7;
        const radius = 7
        const widthSegments = 12
        const heightSegments = 8
        const phiStart = Math.PI * 0
        const phiLength = Math.PI * 1
        const thetaStart = Math.PI * 0.0
        const thetaLength = Math.PI * 0.9
        const domeGeometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength)

        domeGeometry.scale(0.55, 0.55, 0.55)
        const domeMaterial = new THREE.MeshPhongMaterial({ color: DOME_COLOR, side: THREE.DoubleSide })
        const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial)
        domeMesh.position.set(centerX, 1, centerZ)
        domeMesh.lookAt(lookAtX, 2, lookAtZ)
        domeMesh.rotateY(Math.PI)
        this.scene.add(domeMesh)

        // Draw Label (placeholder for now) - make separate functionn?
        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)
        const text = "# " +  projectIndex.toString()

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 1,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.01,
            bevelSegments: 6,
        })

        const fontMaterial = new THREE.MeshPhongMaterial({ color: PROJECT_NUMBER_COLOR, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial)

        let fontOffsetX = 3
        let fontOffsetY = 5
        let fontOffsetZ = -1
        fontMesh.position.set(centerX, 0, centerZ)
        fontMesh.rotateY(angle)
        fontMesh.lookAt(lookAtX, 0, lookAtZ)
        fontMesh.translateX(fontOffsetX)
        fontMesh.translateY(fontOffsetY)
        fontMesh.translateZ(fontOffsetZ)
        this.scene.add(fontMesh)

        this.projectionScreenManager.addScreen(centerX, 2, centerZ, lookAtX, 2, lookAtZ, scaleFactor)
    }

    //circle version of fence
    addCircleFence(centerX, centerZ, lookAtX, lookAtZ) {
        console.log('adding circle')
        // colorsssss //
        var colBlack = 0x000000
        var colWhite = 0xffffff
        var colmainBlue = 0x4b4ff4
        var coldarkBlue = 0x1250cc
        var collightBlue = 0x05c1da
        var colmainPink = 0xfc3691

        //draw the circles
        //center circle
        let offsetX = 0 // how far to the circle's right
        let offsetY = 0 // how far to the circle's up-down
        let offsetZ = -4.5 // how far to the circle's forward-backward
        this.drawCircle(3.5, 32, colmainBlue, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = 4 // how far to the circle's right
        offsetY = -2 // how far to the circle's up-down
        offsetZ = -4.3 // how far to the circle's forward-backward
        this.drawCircle(3, 32, collightBlue, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = -3 // how far to the circle's right
        offsetY = 4 // how far to the circle's up-down
        offsetZ = -4.3 // how far to the circle's forward-backward
        this.drawCircle(1, 32, collightBlue, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX =4 // how far to the circle's right
        offsetY = 3 // how far to the circle's up-down
        offsetZ = -4.3 // how far to the circle's forward-backward
        this.drawCircle(2, 32, coldarkBlue, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        offsetX = 3.5 // how far to the circle's right
        offsetY = 0.25 // how far to the circle's up-down
        offsetZ = -1.5 // how far to the circle's forward-backward
        this.drawCircle(2, 32, colmainPink, centerX, 4.5, centerZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ)

        // let xshift_c1 = 30 * Math.cos(angle + 0.15)
        // let zshift_c1 = 30 * Math.sin(angle + 0.15)
        // this.drawCircle(3, 32, collightBlue, centerX, 7, centerZ, lookAtX, lookAtZ)

        // //med circles
        // let xshift_c2 = 30 * Math.cos(angle - 0.14)
        // let zshift_c2 = 30 * Math.sin(angle - 0.14)
        // this.drawCircle(1, 32, collightBlue, xshift_c2, 4, zshift_c2, lookAtX, lookAtZ)

        // let xshift_c3 = 30 * Math.cos(angle - 0.2)
        // let zshift_c3 = 30 * Math.sin(angle - 0.2)
        // this.drawCircle(2, 32, coldarkBlue, xshift_c3, 7, zshift_c3, lookAtX, lookAtZ)
        // //
        // // //small circles
        // let xshift_c4 = 30 * Math.cos(angle + 0.2)
        // let zshift_c4 = 30 * Math.sin(angle + 0.2)
        // this.drawCircle(1, 32, colmainBlue, xshift_c4, 2, zshift_c4, lookAtX, lookAtZ)

        // let xshift_c5 = 30 * Math.cos(angle - 0.12)
        // let zshift_c5 = 30 * Math.sin(angle - 0.12)
        // this.drawCircle(0.5, 32, colmainPink, xshift_c5, 5, zshift_c5, lookAtX, lookAtZ)

        // //draw fence
        // let xshift_c6 = 30 * Math.cos(angle + 0.3)
        // let zshift_c6 = 30 * Math.sin(angle + 0.3)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c6, 2.5, zshift_c6, lookAtX, lookAtZ)

        // //draw fence
        // let xshift_c7 = 30 * Math.cos(angle + 0.4)
        // let zshift_c7 = 30 * Math.sin(angle + 0.4)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c7, 2, zshift_c7, lookAtX, lookAtZ)

        // //draw fence
        // let xshift_c8 = 30 * Math.cos(angle + 0.5)
        // let zshift_c8 = 30 * Math.sin(angle + 0.5)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c8, 2.5, zshift_c8, lookAtX, lookAtZ)

        // //draw fence
        // let xshift_c9 = 30 * Math.cos(angle + 0.6)
        // let zshift_c9 = 30 * Math.sin(angle + 0.6)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c9, 2, zshift_c9, lookAtX, lookAtZ)
    }

    addRectFence(centerX, centerZ, lookAtX, lookAtZ, angle) {
        // colorsssss //
        var colBlack = 0x000000
        var colWhite = 0xffffff
        var colmainBlue = 0x4b4ff4
        var coldarkBlue = 0x1250cc
        var collightBlue = 0x05c1da
        var colmainPink = 0xfc3691
        var colmainGreen = 0x9be210

        var colmedPink = 0xfb69b9
        var coldarkPink = 0xe49add

        //draw the circles

        //center circle
        this.drawRect(6, 6, 5, colmainPink, centerX, 4.5, centerZ, angle)

        let xshift_c1 = 30 * Math.cos(angle + 0.15)
        let zshift_c1 = 30 * Math.sin(angle + 0.15)
        this.drawRect(6, 4, 5, colmedPink, xshift_c1, 7, zshift_c1, angle)

        // //med circles
        let xshift_c2 = 30 * Math.cos(angle - 0.14)
        let zshift_c2 = 30 * Math.sin(angle - 0.14)
        this.drawRect(5, 5, 5, colmedPink, xshift_c2, 8, zshift_c2, angle)

        let xshift_c3 = 30 * Math.cos(angle - 0.2)
        let zshift_c3 = 30 * Math.sin(angle - 0.2)
        this.drawRect(3, 3, 5, colmainPink, xshift_c3, 7, zshift_c3, angle)
        //

        let xshift_c5 = 30 * Math.cos(angle - 0.12)
        let zshift_c5 = 30 * Math.sin(angle - 0.12)
        this.drawRect(2, 2, 2, colmainGreen, xshift_c5, 5, zshift_c5, angle)

        // //small circles
        let xshift_c4 = 30 * Math.cos(angle + 0.2)
        let zshift_c4 = 30 * Math.sin(angle + 0.2)
        this.drawRect(1.5, 1.5, 5, coldarkPink, xshift_c4, 2, zshift_c4, angle)

        //draw fence
        let xshift_c6 = 30 * Math.cos(angle + 0.3)
        let zshift_c6 = 30 * Math.sin(angle + 0.3)
        this.drawRect(1.5, 1.5, 5, coldarkPink, xshift_c6, 2.5, zshift_c6, angle)

        //draw fence
        let xshift_c7 = 30 * Math.cos(angle + 0.4)
        let zshift_c7 = 30 * Math.sin(angle + 0.4)
        this.drawRect(1.5, 1.5, 5, coldarkPink, xshift_c7, 2, zshift_c7, angle)

        //draw fence
        let xshift_c8 = 30 * Math.cos(angle + 0.5)
        let zshift_c8 = 30 * Math.sin(angle + 0.5)
        this.drawRect(1.5, 1.5, 5, coldarkPink, xshift_c8, 2.5, zshift_c8, angle)

        //draw fence
        let xshift_c9 = 30 * Math.cos(angle + 0.6)
        let zshift_c9 = 30 * Math.sin(angle + 0.6)
        this.drawRect(1.5, 1.5, 5, coldarkPink, xshift_c9, 2, zshift_c9, angle)
    }

    addTriFence(centerX, centerZ, lookAtX, lookAtZ, angle) {
        //  drawTri(scaleX, scaleY, scaleZ, posX, posY, posZ, triColor, angle, rotateDegrees){

        // colorsssss //
        var colBlack = 0x000000
        var colWhite = 0xffffff
        var colmainBlue = 0x4b4ff4
        var coldarkBlue = 0x1250cc
        var collightBlue = 0x05c1da
        var colmainPink = 0xfc3691
        var colmainGreen = 0x9be210
        var colmainYellow = 0xffd810

        var colmedPink = 0xfb69b9
        var coldarkPink = 0xe49add
        var coldarkYellow = 0xf4d01d
        var colOrange = 0xfd8f20

        //draw the circles

        //center circle
        // let xshift_c0 = 30 * Math.cos(angle-0.15);
        // let zshift_c0 = 30 * Math.sin(angle-.15);
        this.drawTri(0.3, 0.3, 0.3, centerX, 4.5, centerZ, coldarkYellow, angle, 0)

        let xshift_c1 = 30 * Math.cos(angle + 0.15)
        let zshift_c1 = 30 * Math.sin(angle + 0.15)
        this.drawTri(0.1, 0.1, 0.1, xshift_c1, 7, zshift_c1, colmainBlue, angle, 0)

        // // //med circles
        // let xshift_c2 = 30 * Math.cos(angle-0.14);
        // let zshift_c2 = 30 * Math.sin(angle-0.14);
        // this.drawTri(0.2, 0.2, 0.2, (xshift_c2), 8, (zshift_c2), colmedPink, angle, 0);

        let xshift_c3 = 30 * Math.cos(angle - 0.2)
        let zshift_c3 = 30 * Math.sin(angle - 0.2)
        this.drawTri(0.05, 0.05, 0.05, xshift_c3, 7, zshift_c3, coldarkYellow, angle, -1.5708 * 3)
        //
        //
        let xshift_c5 = 30 * Math.cos(angle - 0.18)
        let zshift_c5 = 30 * Math.sin(angle - 0.18)
        this.drawTri(0.1, 0.1, 0.1, xshift_c5, 7, zshift_c5, colmainBlue, angle, -1.5708 * 1)

        let xshift_c10 = 30 * Math.cos(angle - 0.12)
        let zshift_c10 = 30 * Math.sin(angle - 0.12)
        this.drawTri(0.25, 0.25, 0.25, xshift_c10, 10, zshift_c10, colmainYellow, angle, -1.5708)

        //
        //
        // //small circles
        let xshift_c4 = 30 * Math.cos(angle + 0.2)
        let zshift_c4 = 30 * Math.sin(angle + 0.2)
        this.drawTri(0.05, 0.05, 0.05, xshift_c4, 2, zshift_c4, colOrange, angle, 0)

        //draw fence
        let xshift_c6 = 30 * Math.cos(angle + 0.3)
        let zshift_c6 = 30 * Math.sin(angle + 0.3)
        this.drawTri(0.05, 0.05, 0.05, xshift_c6, 2.5, zshift_c6, colOrange, angle, 0)

        //draw fence
        let xshift_c7 = 30 * Math.cos(angle + 0.4)
        let zshift_c7 = 30 * Math.sin(angle + 0.4)
        this.drawTri(0.05, 0.05, 0.05, xshift_c7, 2, zshift_c7, colOrange, angle, 0)

        //draw fence
        let xshift_c8 = 30 * Math.cos(angle + 0.5)
        let zshift_c8 = 30 * Math.sin(angle + 0.5)
        this.drawTri(0.05, 0.05, 0.05, xshift_c8, 2.5, zshift_c8, colOrange, angle, 0)

        //draw fence
        let xshift_c9 = 30 * Math.cos(angle + 0.6)
        let zshift_c9 = 30 * Math.sin(angle + 0.6)
        this.drawTri(0.05, 0.05, 0.05, xshift_c9, 2, zshift_c9, colOrange, angle, 0)
    }

    addCenterPiece() {
        // add table

        const centerGeometry = new THREE.SphereGeometry(1, 32, 32)
        const centerMaterial = new THREE.MeshPhongMaterial({ color: 0xfb69b9 })
        const center = new THREE.Mesh(centerGeometry, centerMaterial)
        center.position.set(0, 0, 0)
        this.scene.add(center)

        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)

        const text = 'Circle Room'

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 2,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.01,
            bevelSize: 0.01,
            bevelSegments: 1,
        })

        const fontMaterial = new THREE.MeshPhongMaterial({ color: 0xc6fc03, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial)
        fontMesh.position.set(-1, 2, 0)
        fontMesh.rotateY(Math.PI / 2)

        this.scene.add(fontMesh)
    }

    ///// Shape Helper Functions /////

    //draw circles

    drawCircle(radius, numFaces, matColor, posX, posY, posZ, offsetX, offsetY, offsetZ, lookAtX, lookAtZ) {
        const circlegeometry = new THREE.CircleGeometry(radius, numFaces)
        const circlematerial = new THREE.MeshBasicMaterial({ color: matColor, side: THREE.DoubleSide })
        const circle = new THREE.Mesh(circlegeometry, circlematerial)

        // set circle position and lookAt
        circle.position.set(posX, posY, posZ)
        circle.lookAt(lookAtX, 0, lookAtZ)

        // offsets within object space (i.e. from the circles point of view)
        circle.translateX(offsetX)
        circle.translateY(offsetY)
        circle.translateZ(offsetZ)

        this.scene.add(circle)
    }

    // Draw Square

    drawRect(height, width, faces, planeColor, posX, posY, posZ, angle) {
        //plane  1
        const planegeometry = new THREE.PlaneBufferGeometry(height, width, faces)
        const planematerial = new THREE.MeshPhongMaterial({ color: planeColor, side: THREE.DoubleSide })
        const plane = new THREE.Mesh(planegeometry, planematerial)
        plane.position.set(posX, posY, posZ)
        plane.rotateY(angle)
        plane.lookAt(0, 2, 0)
        this.scene.add(plane)
    }

    // Draw Triangles
    drawTri(scaleX, scaleY, scaleZ, posX, posY, posZ, triColor, angle, rotateDegrees) {
        var triangleGeometry = new THREE.Geometry()
        var v1 = new THREE.Vector3(0, 0, 0)
        var v2 = new THREE.Vector3(30, 0, 0)
        var v3 = new THREE.Vector3(30, 30, 0)

        var triangle = new THREE.Triangle(v1, v2, v3)
        var normal = triangle.normal()

        // An example of getting the area from the Triangle class
        //console.log( 'Area of triangle is: '+ triangle.area() );

        triangleGeometry.vertices.push(triangle.a)
        triangleGeometry.vertices.push(triangle.b)
        triangleGeometry.vertices.push(triangle.c)
        triangleGeometry.faces.push(new THREE.Face3(0, 1, 2, normal))
        triangleGeometry.scale(scaleX, scaleY, scaleZ)

        //geom.scale(new THREE.Vector3(2,2,2));
        const trianglematerial = new THREE.MeshPhongMaterial({ color: triColor, side: THREE.DoubleSide })
        var triangleMesh = new THREE.Mesh(triangleGeometry, trianglematerial)
        triangleMesh.position.set(posX, posY, posZ)
        triangleMesh.rotateY(angle)
        triangleMesh.lookAt(0, 2, 0)
        triangleMesh.rotateZ(rotateDegrees)
        //var triangleScale = new THREE.Vector3(0,0,0);

        this.scene.add(triangleMesh)
    }

    //lay out some random big objects in the distance
    addOuterDecoration() {
        //
        let geo = new THREE.BoxBufferGeometry(20, 120, 30)
        let mat = new THREE.MeshLambertMaterial({ color: 'hotpink' })
        mat.flatShading = true
        let mesh = new THREE.Mesh(geo, mat)
        this.scene.add(mesh)
        mesh.position.set(-70, 20, 120)
        mesh.rotateX(-0.25)

        geo = new THREE.BoxBufferGeometry(10, 30, 80)
        mat = new THREE.MeshLambertMaterial({ color: 'darkblue' })
        mat.flatShading = true
        mesh = new THREE.Mesh(geo, mat)
        this.scene.add(mesh)
        mesh.position.set(70, 60, -120)

        geo = new THREE.ConeBufferGeometry(10, 200, 4)
        mat = new THREE.MeshLambertMaterial({ color: 'red' })
        mat.flatShading = true
        mesh = new THREE.Mesh(geo, mat)
        this.scene.add(mesh)
        mesh.position.set(-30, 0, -90)
        mesh.rotateY(3);
    }

    addFloor() {
        // add the ITP floor
        const floorTexture = new THREE.TextureLoader().load(require('../assets/images/textures/floor.jpg'))
        floorTexture.wrapS = THREE.RepeatWrapping
        floorTexture.wrapT = THREE.RepeatWrapping
        floorTexture.repeat.set(40, 40)

        const floorGeometry = new THREE.PlaneBufferGeometry(512, 512, 1, 1)
        const floorMaterial = new THREE.MeshPhongMaterial({ map: floorTexture, side: THREE.DoubleSide })
        const plane = new THREE.Mesh(floorGeometry, floorMaterial)
        plane.lookAt(0, 1, 0)
        this.scene.add(plane)
    }

    /*
     * createHyperlinkedMesh(x,y,z,_project)
     *
     * Description:
     * 	- creates an object3D for each project at position x,y,z
     *	- adds _project as userData to the object3D
     *	- returns object3D
     */

    createHyperlinkedMesh(x, y, z, lookAtX, lookAtZ, _project) {
        let linkDepth = 0.1
        let fontColor = 0x343434
        let statusColor = 0xffffff
        let fontSize = 0.05

        var geometry = new THREE.BoxGeometry(linkDepth, 0.75, 0.75)
        var textBoxGeometry = new THREE.BoxGeometry(linkDepth, 0.5, 0.75)

        let textBoxMat

        // check whether we've visited the link before and set material accordingly
        if (localStorage.getItem(_project.project_id) == 'visited') {
            textBoxMat = this.linkVisitedMaterial
        } else {
            textBoxMat = this.linkMaterial
        }

        let tex
        if (project_thumbnails[_project.project_id]) {
            tex = this.textureLoader.load(project_thumbnails[_project.project_id])
        } else {
            tex = this.textureLoader.load(project_thumbnails['0000']) // default texture
        }
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(1, 1)

        let imageMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: tex,
        })

        this.linkMaterials[_project.project_id.toString()] = imageMat

        var textSign = new THREE.Mesh(textBoxGeometry, textBoxMat)
        var imageSign = new THREE.Mesh(geometry, imageMat)

        // parse text of name and add line breaks if necessary
        var name = this.parseText(_project.project_name)
        if (name.length > 15) {
            name = this.addLineBreak(name)
        }

        // create name text mesh
        var textMesh = createSimpleText(name, fontColor, fontSize, this.font)

        textMesh.position.x += linkDepth / 2 + 0.01 // offset forward
        textMesh.rotateY(Math.PI / 2)

        imageSign.position.set(x, y, z)
        textSign.position.set(0, -0.75 / 2 - 0.5 / 2, 0)
        textSign.add(textMesh)
        imageSign.add(textSign)

        // parse zoom room status
        var status_code = _project.zoom_status
        let status = ''
        // status_code = 1;
        if (status_code == '1') {
            var statusBoxGemoetry = new THREE.BoxGeometry(linkDepth, 0.125, 0.5)
            var statusSign = new THREE.Mesh(statusBoxGemoetry, this.statusBoxMaterial)
            status = 'Live now!'
            var statusTextMesh = createSimpleText(status, statusColor, fontSize, this.font)
            statusTextMesh.position.x += linkDepth / 2 + 0.01
            statusTextMesh.position.y -= 0.0625
            statusTextMesh.rotateY(Math.PI / 2)
            statusSign.add(statusTextMesh)
            statusSign.position.y += 0.25
            statusSign.position.x += 0.01

            imageSign.add(statusSign)
        }

        // https://stackoverflow.com/questions/24690731/three-js-3d-models-as-hyperlink/24692057
        let now = Date.now()
        imageSign.userData = {
            project: _project,
            lastVisitedTime: now,
        }

        imageSign.name = _project.project_id
        return imageSign
    }

    /*
     * updateProjects(projects)
     *
     * Description:
     * 	- empties out the existing projects array and any existing hyperlink objects within it
     * 	- creates XYZ locations for each of the new project hyperlinks
     * 	- calls this.createHyperlinkedMesh for each project in the projects array
     * 	- places returned objects in this.hyperlinkedObjects array and adds them to the scene
     *
     */
    updateProjects(projects) {
        this.projects = projects
        this._updateProjects()
    }

    _updateProjects() {
        if (this.font) {
            let projects = this.projects

            for (let i = 0; i < this.hyperlinkedObjects.length; i++) {
                this.scene.remove(this.hyperlinkedObjects[i])
            }
            this.hyperlinkedObjects = []

            // do a check for duplicates
            let dupeCheck = {}
            let numUniqueProjects = 0

            let uniqueProjects = []

            // do a duplicate check
            for (let projectIndex = 0; projectIndex < projects.length; projectIndex++) {
                let proj = projects[projectIndex]
                if (proj) {
                    let project_id = proj.project_id

                    if (dupeCheck[project_id]) {
                        // console.log('Duplicate with ID: ', proj.project_id);
                    } else {
                        dupeCheck[project_id] = true
                        numUniqueProjects++
                        uniqueProjects.push(proj)
                    }
                }
            }
            // console.log('Number of total projects: ', this.projects.length)
            // console.log('Number of unique projects: ', numUniqueProjects)

            // then plae all of the unique projects
            for (let i = 0; i < uniqueProjects.length; i++) {
                let proj = uniqueProjects[i]
                let locX = -23.55
                let locZ = -80 + i * 1
                let hyperlink = this.createHyperlinkedMesh(locX, 1.75, locZ, proj)
                this.hyperlinkedObjects.push(hyperlink)
                this.scene.add(hyperlink)
            }

            // console.log("We've placed ", endIndex, ' projects so far.')
        }
    }

    // this decodes the text twice because the project database seems to be double wrapped in html...
    // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript
    parseText(encodedStr) {
        var dom = this.textParser.parseFromString('<!doctype html><body>' + encodedStr, 'text/html')
        var decodedString = dom.body.textContent
        var dom2 = this.textParser.parseFromString('<!doctype html><body>' + decodedString, 'text/html')
        var decodedString2 = dom2.body.textContent
        return decodedString2
    }

    addLineBreak(longString) {
        let spaceIndex = longString.indexOf(' ', 10)
        if (spaceIndex != -1) {
            let firstHalf = longString.slice(0, spaceIndex)
            let secondHalf = longString.slice(spaceIndex, longString.length)
            if (secondHalf.length > 15) {
                secondHalf = this.addLineBreak(secondHalf)
            }
            return firstHalf.trim() + '\n' + secondHalf.trim()
        } else {
            return longString
        }
    }

    /*
     * generateProjectModal(project)
     *
     * Description:
     * 	- generates a modal pop up for a given project object
     * 	- project objects look like this:
     *		{
     *			"project_id": "1234",
     *			"project_name": "Cats",
     *			"elevator_pitch": "Cats are loving companions for now and all time.",
     *			"description": "Cats is about building a sustainable online community for earth humans.",
     *			"zoom_link": "http://example.com"
     *		}
     *
     */
    zoomStatusDecoder(status) {
        if (status == '0') {
            return 'Currently Offline'
        } else if (status == '1') {
            return 'Currently Live'
        } else if (status == '2') {
            return 'Project Creator Will Be Right Back'
        } else if (status == '3') {
            return 'Room Full Try Again Soon'
        } else {
            return ''
        }
    }
    generateProjectModal(project) {
        // parse project descriptions to render without &amp; etc.
        // https://stackoverflow.com/questions/3700326/decode-amp-back-to-in-javascript

        if (!document.getElementsByClassName('project-modal')[0]) {
            this.controls.pause()
            localStorage.setItem(project.project_id, 'visited')

            let id = project.project_id
            let name = project.project_name
            let pitch = project.elevator_pitch
            let description = project.description
            let link = project.zoom_link
            let room_status = this.zoomStatusDecoder(project.zoom_status)

            let modalEl = document.createElement('div')
            modalEl.className = 'project-modal'
            modalEl.id = id + '_modal'

            let contentEl = document.createElement('div')
            contentEl.className = 'project-modal-content'

            let closeButton = document.createElement('button')
            closeButton.addEventListener('click', () => {
                modalEl.remove()
                // https://stackoverflow.com/questions/19426559/three-js-access-scene-objects-by-name-or-id
                let now = Date.now()
                let link = this.scene.getObjectByName(id)
                link.userData.lastVisitedTime = now
                this.controls.resume()
                setTimeout(() => {
                    this.activeProjectId = -1
                }, 100) // this helps reset without reopening the modal
            })
            closeButton.innerHTML = 'X'

            let projectImageEl = document.createElement('img')
            let filename = 'https://itp.nyu.edu' + project.image
            // let filename = "images/project_thumbnails/" + project.project_id + ".png";
            projectImageEl.src = filename
            projectImageEl.className = 'project-modal-img'

            let titleEl = document.createElement('h1')
            titleEl.innerHTML = this.parseText(name)
            titleEl.className = 'project-modal-title'

            // names
            let names = ''
            for (let i = 0; i < project.users.length; i++) {
                names += project.users[i].user_name
                if (i < project.users.length - 1) {
                    names += ' & '
                }
            }
            let namesEl = document.createElement('p')
            namesEl.innerHTML = names
            namesEl.className = 'project-modal-names'

            let elevatorPitchHeaderEl = document.createElement('p')
            elevatorPitchHeaderEl.innerHTML = 'Elevator Pitch'
            let elevatorPitchEl = document.createElement('p')
            elevatorPitchEl.innerHTML = this.parseText(pitch)
            elevatorPitchEl.className = 'project-modal-text'

            let descriptionHeaderEl = document.createElement('p')
            descriptionHeaderEl.innerHTML = 'Description'
            let descriptionEl = document.createElement('p')
            descriptionEl.innerHTML = this.parseText(description)
            descriptionEl.className = 'project-modal-text'

            let talkToCreatorDiv = document.createElement('div')
            talkToCreatorDiv.className = 'project-modal-links-header'
            talkToCreatorDiv.innerHTML = 'Talk To The Project Creator In The Zoom Room:'

            let linksDiv = document.createElement('div')
            linksDiv.className = 'project-modal-link-container'

            let projectLinkEl = document.createElement('a')
            // projectLinkEl.href = link;
            projectLinkEl.href = project.url
            projectLinkEl.innerHTML = 'Project Website'
            projectLinkEl.target = '_blank'
            projectLinkEl.rel = 'noopener noreferrer'

            let zoomLinkEl = document.createElement('a')
            // zoomLinkEl.href = link
            zoomLinkEl.href = link
            zoomLinkEl.innerHTML = 'Zoom Room - ' + room_status
            zoomLinkEl.target = '_blank'
            zoomLinkEl.rel = 'noopener noreferrer'

            linksDiv.appendChild(projectLinkEl)
            linksDiv.innerHTML += '&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;'
            linksDiv.appendChild(zoomLinkEl)

            contentEl.appendChild(closeButton)
            contentEl.appendChild(projectImageEl)
            contentEl.appendChild(titleEl)
            contentEl.appendChild(namesEl)
            contentEl.appendChild(elevatorPitchHeaderEl)
            contentEl.appendChild(elevatorPitchEl)
            contentEl.appendChild(descriptionHeaderEl)
            contentEl.appendChild(descriptionEl)
            contentEl.appendChild(talkToCreatorDiv)
            contentEl.appendChild(linksDiv)

            modalEl.appendChild(contentEl)
            document.body.appendChild(modalEl)
        }
    }

    /*
     * highlightHyperlinks()
     *
     * Description:
     * 	- checks distance between player and object3Ds in this.hyperlinkedObjects array,
     * 	- calls this.generateProjectModal for any projects under a threshold distance
     *
     */
    highlightHyperlinks() {
        let thresholdDist = 5
        let now = Date.now()

        // store reference to last highlighted project id
        let lastHighlightedProjectId = this.hightlightedProjectId

        // cast ray out from camera
        this.raycaster.setFromCamera(this.mouse, this.camera)

        var intersects = this.raycaster.intersectObjects(this.hyperlinkedObjects)

        // if we have intersections, highlight them
        if (intersects.length > 0) {
            if (intersects[0].distance < thresholdDist) {
                let link = intersects[0].object
                this.hightlightedProjectId = link.userData.project.project_id
                // do styling
                this.highlightLink(link)
            }
        }

        // if we've changed which project is highlighted
        if (lastHighlightedProjectId != this.hightlightedProjectId) {
            let link = this.scene.getObjectByName(lastHighlightedProjectId)
            if (link != null) {
                // reset styling
                this.resetLinkMaterial(link)
            }
        } else {
            // no change, so lets check for
            let link = this.scene.getObjectByName(this.hightlightedProjectId)
            if (link != null) {
                if (now - link.userData.lastVisitedTime > 500) {
                    // reset styling
                    this.hightlightedProjectId = -1
                    this.resetLinkMaterial(link)
                }
            }
        }
    }

    highlightLink(link) {
        let now = Date.now()
        link.userData.lastVisitedTime = now
        link.userData.highlighted = true

        link.children[0].material = this.highlightMaterial
        link.scale.set(1.1, 1.1, 1.1)
    }

    resetLinkMaterial(link) {
        link.scale.set(1, 1, 1)
        // reset according to whether we have visited it or not yet
        let mat
        // check whether we've visited the link before and set material accordingly
        if (localStorage.getItem(link.userData.project.project_id) == 'visited') {
            mat = this.linkVisitedMaterial
        } else {
            mat = this.linkMaterial
        }
        // console.log(link);
        link.children[0].material = mat
    }

    activateHighlightedProject() {
        if (this.hightlightedProjectId != -1 && this.activeProjectId === -1) {
            let link = this.scene.getObjectByName(this.hightlightedProjectId)
            if (link != null) {
                this.generateProjectModal(link.userData.project)
                hackToRemovePlayerTemporarily()

                // reset markers
                this.activeProjectId = link.userData.project.project_id
            }
        }
    }

    update() {
        if (this.activeProjectId == -1) {
            this.highlightHyperlinks()
        }
    }

    onMouseClick(e) {
        this.activateHighlightedProject()
    }
}
