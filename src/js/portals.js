//can ask August if you have questions about this!
//models from YG using Vectary ~ * ~ * ../assets/models/portals

import * as THREE from 'three'
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'


//when yorb.js creates a yorblet, it also needs that yorblets url and portal model
//then in the yorblet, it creates a portal from here using those arguments
export class Portal {
    constructor(scene, portal, destination){
        this.scene = scene; //da sceneee
        this.model = portal.model; //path to glb
        this.position = portal.position; //vec3
        this.destination = destination; //url
        this.radius = 1; //will need to test TODO

        this.portalLoader = new GLTFLoader();
        // this.loadPortalModel(require(this.model));
        this.loadPortalModel(this.model);
        
        // this.loadPetModels();
        // portalLoader.load(this.model, function (gltf) {
        //     let portalScene = gltf.scene;
        //     portalScene.position.set(this.position);
        //     this.scene.add(portalScene);
        //     console.log("portal added")
        //     //don't need scale or name?
        //     }, undefined, function (error) {
        //     console.error(error);
        //     }
        // );
    }
    loadPortalModel(modelPath) {
        console.log('model path: ' + this.model);
        this.portalLoader.load(
            modelPath,
            (gltf) => {
                let portalScene = gltf.scene
                portalScene.position.set(this.position.x, this.position.y, this.position.z)
                // portalScene.scale.set(_scale, _scale, _scale)
                portalScene.traverse((child) => {
                    if (child.isMesh) {
                        // child.material = _material
                        child.castShadow = true
                        child.receiveShadow = true
                    }
                })
                this.scene.add(portalScene)
            },
            undefined,
            function (e) {
                console.log('trying to load portal');
                console.error(e)
            }
        )
    }

    // loadPetModels(){
	// 	let petLoader = new GLTFLoader();
	// 	petLoader.load('../assets/models/portals/dog.gltf', (gltf)=>{
	// 		let dogScene = gltf.scene;
	// 		dogScene.position.set(-20, .5, 0); //trying to put in elevator bank for now
	// 		dogScene.rotation.set(0, -90, 0);
	// 		dogScene.scale.set(.5, .5, .5);
	// 		dogScene.traverse((child)=>{
	// 			if (child.isMesh){
	// 				// child.material ??
	// 				child.castShadow = true;
	// 				child.receiveShadow = true;
	// 				// this.collidableMeshList.push(child);					
	// 			}
	// 		});
	// 		this.scene.add(dogScene);
	// 		// let name = "skate dog";
	// 		// scene.name = name;
	// 		// this.pets.push(scene);
    //         }, (xhr)=>{
    //             console.log("dog " + (xhr.loaded/xhr.total * 100) + "% loaded");
    //         },(error)=>{
    //             console.log('error in pet load');
    //             console.log(error);
    //         });
    // }
    
    teleportCheck(userPosition){
        //need to change because getPlayerPosition doesn't return a vec3
        let userVec3 = new Vector3(userPosition[0], userPosition[1], userPosition[2]);
        console.log('distance: ' + this.position.distanceTo(userVec3));
        if(this.position.distanceTo(userVec3) <= this.radius){
            console.log('teleporting');
            // window.open('https://yorb.itp.io/experimental'); //send them to lobby TODO update url
            window.open(this.destination);
            return true; //for the trigger that removes the user from this yorblet
        }
        return false;
    }

}