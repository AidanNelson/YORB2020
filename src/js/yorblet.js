import * as THREE from 'three'
import { create3DText, createSimpleText } from './utils'

export class Yorblet {
    constructor(scene, projectionScreenManager) {
        this.scene = scene
        this.projectionScreenManager = projectionScreenManager
        this.setup()
    }

    setup() {
        this.addCylindricalRoom()
        // this.addSquareRoom();
        //this.addPerformanceRoom();

        this.addFloor()
        this.addCenterPiece()
    }

    ///// Shape Helper Functions /////

    //draw circles

    drawCircle(radius, numFaces, matColor, posX, posY, posZ, angle) {
        const circlegeometry = new THREE.CircleGeometry(radius, numFaces)
        const circlematerial = new THREE.MeshBasicMaterial({ color: matColor })
        const circle = new THREE.Mesh(circlegeometry, circlematerial)
        circle.position.set(posX, posY, posZ)
        circle.rotateY(angle)
        circle.lookAt(0, 0, 0)
        this.scene.add(circle)
    }

    // Draw Square

    drawRect(height, width, faces, planeColor, posX, posY, posZ, angle) {
        //plane  1
        const planegeometry = new THREE.PlaneBufferGeometry(height, width, faces)
        const planematerial = new THREE.MeshBasicMaterial({ color: planeColor, side: THREE.DoubleSide })
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
        const trianglematerial = new THREE.MeshBasicMaterial({ color: triColor, side: THREE.DoubleSide })
        var triangleMesh = new THREE.Mesh(triangleGeometry, trianglematerial)
        triangleMesh.position.set(posX, posY, posZ)
        triangleMesh.rotateY(angle)
        triangleMesh.lookAt(0, 2, 0)
        triangleMesh.rotateZ(rotateDegrees)
        //var triangleScale = new THREE.Vector3(0,0,0);

        this.scene.add(triangleMesh)
    }

    //

    addDoor(centerX, centerY, centerZ, lookAtX, lookAtY, lookAtZ) {
        const doorGeometry = new THREE.BoxBufferGeometry(1, 2, 0.1)
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x000000 })
        const doorMesh = new THREE.Mesh(doorGeometry, doorMat)
        doorMesh.position.set(centerX, centerY, centerZ)
        doorMesh.lookAt(lookAtX, lookAtY, lookAtZ)
        this.scene.add(doorMesh)
    }

    addSquareRoom() {
        const cubeGeometry = new THREE.BoxBufferGeometry(36, 10, 36)
        const wallMat = new THREE.MeshLambertMaterial({
            color: 0xffffe6,
            side: THREE.DoubleSide,
        })
        const ceilingMat = new THREE.MeshLambertMaterial({
            color: 0x0000ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5,
        })
        const cubeMesh = new THREE.Mesh(cubeGeometry, [wallMat, wallMat, ceilingMat, wallMat, wallMat, wallMat])
        cubeMesh.position.set(0, 4.95, 0)
        this.scene.add(cubeMesh)

        this.addPresentationStage(-12, -12)
        this.addPresentationStage(-12, 12)
        this.addPresentationStage(12, -12)
        this.addPresentationStage(12, 12)

        this.addDoor(18, 1, 0, 0, 1, 0)
    }

    addFloor() {
        // add the ITP floor
        const floorTexture = new THREE.TextureLoader().load(require('../assets/images/textures/floor.jpg'))
        floorTexture.wrapS = THREE.RepeatWrapping
        floorTexture.wrapT = THREE.RepeatWrapping
        floorTexture.repeat.set(10, 10)

        const floorGeometry = new THREE.PlaneBufferGeometry(128, 128, 1, 1)
        const floorMaterial = new THREE.MeshBasicMaterial({ map: floorTexture, side: THREE.DoubleSide })
        const plane = new THREE.Mesh(floorGeometry, floorMaterial)
        plane.lookAt(0, 1, 0)
        this.scene.add(plane)
    }

    addCylindricalRoom() {
        // const cylinderGeometry = new THREE.CylinderBufferGeometry(36, 36, 10, 32, 1, true, 0, Math.PI * 1.95)
        // const cylinderMaterial = new THREE.MeshLambertMaterial({
        //     color: 0x000000,
        //     side: THREE.DoubleSide,
        // })
        // const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        // this.scene.add(cylinder)

        // https://stackoverflow.com/questions/24273990/calculating-evenly-spaced-points-on-the-perimeter-of-a-circle
        let numProjects = 8
        let radius = 30
        for (let i = 0; i < numProjects; i++) {
            let theta = (Math.PI * 2) / numProjects
            let angle = theta * i

            let centerX = radius * Math.cos(angle)
            let centerZ = radius * Math.sin(angle)
            this.addPresentationStage(centerX, centerZ, 1, angle)
        }
    }

    addPresentationStage(centerX, centerZ, scaleFactor = 1, angle) {
        const cylinderGeometry = new THREE.CylinderBufferGeometry(3 * scaleFactor, 3 * scaleFactor, 1, 32, 1, false)
        const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(centerX, 0, centerZ)
        //cylinder.lookAt(0,0,0);
        this.scene.add(cylinder)

        this.addCircleFence(centerX, centerZ, angle)

        //this.addRectFence(centerX, centerZ, angle);

        //this.addTriFence(centerX, centerZ, angle);

        // making a mini dome
        //https://threejsfundamentals.org/threejs/lessons/threejs-primitives.html
        //trying sphereGeometryconst radius = 7;

        const radius = 7
        const widthSegments = 12
        const heightSegments = 8
        const phiStart = Math.PI * 0
        const phiLength = Math.PI * 1
        const thetaStart = Math.PI * 0.1
        const thetaLength = Math.PI * 0.5
        const domeGeometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength)

        domeGeometry.scale(1, 1, 1)
        const domeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial)
        domeMesh.position.set(centerX, 1, centerZ)
        domeMesh.lookAt(0, 2, 0)
        domeMesh.rotateY(Math.PI)
        this.scene.add(domeMesh)

        //// Draw Label (placeholder for now) - make separate functionn?
        const fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json')
        const font = new THREE.Font(fontJson)

        const text = 'Lydia Jessup'

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 0.25,
            height: 0.01,
            curveSegments: 11,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.01,
            bevelSegments: 6,
        })

        const fontMaterial = new THREE.MeshPhongMaterial({ color: 0x1250cc, flatShading: true })
        const fontMesh = new THREE.Mesh(fontGeometry, fontMaterial)

        let font_xshift = 30 * Math.cos(angle + 0.1)
        let font_zshift = 30 * Math.sin(angle + 0.1)
        fontMesh.position.set(font_xshift, 1.5, font_zshift)
        fontMesh.rotateY(angle)
        fontMesh.lookAt(0, 0, 0)
        this.scene.add(fontMesh)

        this.projectionScreenManager.addScreen(centerX, 2, centerZ, 0, 2, 0, scaleFactor)
    }

    //circle version of fence
    addCircleFence(centerX, centerZ, angle) {
        // colorsssss //
        var colBlack = 0x000000
        var colWhite = 0xffffff
        var colmainBlue = 0x4b4ff4
        var coldarkBlue = 0x1250cc
        var collightBlue = 0x05c1da
        var colmainPink = 0xfc3691

        //draw the circles

        //center circle
        this.drawCircle(3.5, 32, colmainBlue, centerX, 4.5, centerZ, angle)

        let xshift_c1 = 30 * Math.cos(angle + 0.15)
        let zshift_c1 = 30 * Math.sin(angle + 0.15)
        this.drawCircle(3, 32, collightBlue, xshift_c1, 7, zshift_c1, angle)

        //med circles
        let xshift_c2 = 30 * Math.cos(angle - 0.14)
        let zshift_c2 = 30 * Math.sin(angle - 0.14)

        this.drawCircle(1, 32, collightBlue, xshift_c2, 4, zshift_c2, angle)

        let xshift_c3 = 30 * Math.cos(angle - 0.2)
        let zshift_c3 = 30 * Math.sin(angle - 0.2)
        this.drawCircle(2, 32, coldarkBlue, xshift_c3, 7, zshift_c3, angle)
        //
        // //small circles
        let xshift_c4 = 30 * Math.cos(angle + 0.2)
        let zshift_c4 = 30 * Math.sin(angle + 0.2)
        this.drawCircle(1, 32, colmainBlue, xshift_c4, 2, zshift_c4, angle)

        let xshift_c5 = 30 * Math.cos(angle - 0.12)
        let zshift_c5 = 30 * Math.sin(angle - 0.12)
        this.drawCircle(0.5, 32, colmainPink, xshift_c5, 5, zshift_c5, angle)

        //draw fence
        // let xshift_c6 = 30 * Math.cos(angle + 0.3)
        // let zshift_c6 = 30 * Math.sin(angle + 0.3)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c6, 2.5, zshift_c6, angle)

        // //draw fence
        // let xshift_c7 = 30 * Math.cos(angle + 0.4)
        // let zshift_c7 = 30 * Math.sin(angle + 0.4)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c7, 2, zshift_c7, angle)

        // //draw fence
        // let xshift_c8 = 30 * Math.cos(angle + 0.5)
        // let zshift_c8 = 30 * Math.sin(angle + 0.5)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c8, 2.5, zshift_c8, angle)

        // //draw fence
        // let xshift_c9 = 30 * Math.cos(angle + 0.6)
        // let zshift_c9 = 30 * Math.sin(angle + 0.6)
        // this.drawCircle(1, 32, coldarkBlue, xshift_c9, 2, zshift_c9, angle)
    }

    addRectFence(centerX, centerZ, angle) {
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

    addTriFence(centerX, centerZ, angle) {
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

        let text = "Back to YORB"

        const fontGeometry = new THREE.TextBufferGeometry(text, {
            font: font,
            size: 0.25,
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

        this.scene.add(fontMesh)
    }

    addPerformanceRoom() {
        const sphereGeometry = new THREE.SphereBufferGeometry(32, 32, 32)
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x2323ff, side: THREE.DoubleSide })
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)

        // https://stackoverflow.com/questions/31539130/display-wireframe-and-solid-color
        // wireframe
        const slightlySmallerSphereGeo = new THREE.SphereBufferGeometry(31.95, 32, 32)
        var geo = new THREE.EdgesGeometry(slightlySmallerSphereGeo) // or WireframeGeometry
        var mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
        var wireframe = new THREE.LineSegments(geo, mat)
        sphere.add(wireframe)

        this.scene.add(sphere)

        const cylinderGeometry = new THREE.CylinderBufferGeometry(5, 5, 1, 32, 1, false)
        const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
        cylinder.position.set(0, 0, -10)
        this.scene.add(cylinder)

        this.projectionScreenManager.addScreen(0, 6, -10, 0, 2, 0, 3)
    }
}
