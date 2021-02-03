/*
 * This is a template file which you can use to build something in YORB.
 *
 *
 * To use this file, follow these steps:
 * 1. Create a copy of this file with a fun new name related to the additional feature you're building (i.e. "labyrinth.js")
 * 2. In that file, rename the class from "MyYorbClassTemplate" to match the file name (i.e. "export class labyrinth {...}")
 * 3. Add additional objects / functionality to the Yorb by using this.scene and this.camera
 * 4. Make sure to add an object of this class to the "yorb.js" file (and update in the update loop as needed!)
 *
 * If you have any questions, contact the Yorb Club on Discord!
 *
 */

import { create3DText, createSimpleText } from './utils';
import * as THREE from 'three';

const scene = scene;
const camera = camera;

export class Calendar {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        let fontJson = require('../assets/fonts/helvetiker_regular_copy.typeface.json');
        this.font = new THREE.Font(fontJson);
    }

    update(events) {
        console.log('Upcoming events:', events);

        if (events.length > 0) {
            for (let i = 0; i < events.length; i++) {
                var event = events[i];
                console.log(event);
                var when = event.start.dateTime;
                if (!when) {
                    when = event.start.date;
                }
                let eventMesh = this.createHyperlinkedMesh(40 + i * 1, 2, -20, event);
                this.scene.add(eventMesh);
            }
        } else {
            // appendPre('No upcoming events found.');
            console.log('No upcoming events found.');
        }
    }

    addCalendarItem(x, y, z, message) {
        let cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        let cubeMaterial = new THREE.MeshBasicMaterial({ color: 'blue' });
        let cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cubeMesh.position.set(x, y, z);

        let txt = create3DText(message, 0.25, 0.01, 10, 0.01, 0.01, true, false, this.font, 0xf9f910);
        txt.position.set(x, y, z);
        txt.rotateY(-Math.PI / 2);
        this.scene.add(txt);

        // this.scene.add(cubeMesh);
    }

    /*
     * createHyperlinkedMesh(x,y,z,_project)
     *
     * Description:
     * 	- creates an object3D for each project at position x,y,z
     *	- adds _project as userData to the object3D
     *	- returns object3D
     */

    createHyperlinkedMesh(x, y, z, event) {
        let linkDepth = 0.1;
        let fontColor = 0x343434;
        let statusColor = 0xffffff;
        let fontSize = 0.05;

        var geometry = new THREE.BoxGeometry(linkDepth, 0.75, 0.75);
        var textBoxGeometry = new THREE.BoxGeometry(linkDepth, 0.5, 0.75);

        let textBoxMat = new THREE.MeshBasicMaterial();

        // check whether we've visited the link before and set material accordingly
        // if (localStorage.getItem(_project.project_id) == 'visited') {
        //     textBoxMat = this.linkVisitedMaterial
        // } else {
        //     textBoxMat = this.linkMaterial
        // }

        // let tex
        // if (project_thumbnails[_project.project_id]) {
        //     tex = this.textureLoader.load(project_thumbnails[_project.project_id])
        // } else {
        //     tex = this.textureLoader.load(project_thumbnails['0000']) // default texture
        // }
        // tex.wrapS = THREE.RepeatWrapping
        // tex.wrapT = THREE.RepeatWrapping
        // tex.repeat.set(1, 1)

        let imageMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            // map: tex,
        });

        // this.linkMaterials[_project.project_id.toString()] = imageMat

        var textSign = new THREE.Mesh(textBoxGeometry, textBoxMat);
        var imageSign = new THREE.Mesh(geometry, imageMat);

        // parse text of name and add line breaks if necessary
        var name = event.summary;
        // if (name.length > 15) {
        //     name = this.addLineBreak(name)
        // }

        // create name text mesh
        var textMesh = createSimpleText(name, fontColor, fontSize, this.font);

        textMesh.position.x += linkDepth / 2 + 0.01; // offset forward
        textMesh.rotateY(Math.PI / 2);

        imageSign.position.set(x, y, z);
        textSign.position.set(0, -0.75 / 2 - 0.5 / 2, 0);
        textSign.add(textMesh);
        imageSign.add(textSign);

        // parse zoom room status
        // var status_code = _project.zoom_status
        // let status = ''
        // // status_code = 1;
        // if (status_code == '1') {
        //     var statusBoxGemoetry = new THREE.BoxGeometry(linkDepth, 0.125, 0.5)
        //     var statusSign = new THREE.Mesh(statusBoxGemoetry, this.statusBoxMaterial)
        //     status = 'Live now!'
        //     var statusTextMesh = createSimpleText(status, statusColor, fontSize, this.font)
        //     statusTextMesh.position.x += linkDepth / 2 + 0.01
        //     statusTextMesh.position.y -= 0.0625
        //     statusTextMesh.rotateY(Math.PI / 2)
        //     statusSign.add(statusTextMesh)
        //     statusSign.position.y += 0.25
        //     statusSign.position.x += 0.01

        //     imageSign.add(statusSign)
        // }

        // https://stackoverflow.com/questions/24690731/three-js-3d-models-as-hyperlink/24692057
        // let now = Date.now()
        // imageSign.userData = {
        //     project: _project,
        //     lastVisitedTime: now,
        // }

        // imageSign.name = _project.project_id

        imageSign.lookAt(0, 1.5, 0);
        imageSign.rotateY(-Math.PI / 2);
        imageSign.translateZ(2);
        imageSign.translateX(7);
        imageSign.translateY(0.25);

        // let pedestalGeo = new THREE.CylinderBufferGeometry(0.5, 0.65, 1, 12)
        // let pedestalMat = new THREE.MeshBasicMaterial({ color: 0x232323, flatShading: true, side: THREE.DoubleSide })
        // let pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat)
        // let pedestalGeoBigger = new THREE.CylinderBufferGeometry(0.5 + 0.01, 0.65+ 0.01, 1+ 0.01, 12)
        // const wireframe = new THREE.WireframeGeometry(pedestalGeoBigger)
        // const line = new THREE.LineSegments(wireframe)

        // line.material.depthTest = true
        // line.material.opacity = 0.25
        // line.material.transparent = false

        // imageSign.add(pedestalMesh)
        // pedestalMesh.add(line);
        // pedestalMesh.position.set(0, -1.5, 0)

        return imageSign;
    }
}
