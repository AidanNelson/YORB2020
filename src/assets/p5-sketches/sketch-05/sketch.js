/*
 * Welcome to the YORB !
 * This is where you can add your P5 sketch into the space!
 * In order to do so, please fill out the following configuration object,
 * then add your sketch below
 *
 */


window.yorbConfig = {
  // set this to true!
  active: true,

  name: "Aidan Nelson",
  
  description: "Just testing out the new sketch feature!",

  // choose a shape on which to put your p5 sketch!
  // options are: box, sphere, cylinder, ico
  shape: "cylinder",

  // set the position of your sketch within the 3D YORB space here:
  // to find out what position makes sense, go to yorb.itp.io,
  // open the javascript console, then navigate to where you want the sketch,
  // and press the 'p' key.  A series of coordinates should appear in your console,
  // then plug those values in here:
  position: {
    x: -2.7,
    y: 2,
    z: -42.6,
  },
  // set the rotation of your sketch here:
  rotation: {
    x: 0,
    y: 0,
    z: 0,
  },
  // set the scale of your sketch here (1-4 are reasonable values):
  scale: {
    x: 1,
    y: 1,
    z: 1,
  },
};




// Put your sketch below
//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//~//

function setup(){
  createCanvas(400,400);
}

function draw(){
  background(200,100,100);
  rect(10,10,50,50);
}
