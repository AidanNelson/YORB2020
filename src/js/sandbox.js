/*
* This page let's you add code to the YORB!
* sceneSetup will be called while the YORB is being created.
* sceneDraw will be called once every frame.
*
*
*/
import * as THREE from "three";


let myMesh;


export function sceneSetup(scene){
    // this code will be called once inside of the 'addYORBParts()' function
    // in the yorb.js file
    
    let geometry = new THREE.BoxGeometry(1,1,1);
    let material = new THREE.MeshNormalMaterial();
    
    myMesh = new THREE.Mesh(geometry, material);

    scene.add(myMesh);
}

export function sceneDraw(scene){
    // this code will be called each frame inside of the 'update()' function
    // in the yorb.js file

    myMesh.rotateY(0.001);
    myMesh.rotateX(0.01);
}