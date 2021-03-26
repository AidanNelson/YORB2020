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


import * as THREE from "three";

export class MyYorbClassTemplate {
    constructor(scene, camera) {

        this.scene = scene;
        this.camera = camera;
        
        this.doSomething();
    }

    doSomething() {
        let cubeGeometry = new THREE.BoxGeometry(1,1,1);
        let cubeMaterial = new THREE.MeshBasicMaterial({color: 'blue'});
        let cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cubeMesh.position.set(0,2,0);

        this.scene.add(cubeMesh);
    }

}