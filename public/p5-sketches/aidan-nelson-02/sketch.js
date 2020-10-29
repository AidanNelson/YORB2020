// where do you want your sketch to live in the space
window.yorbConfig = {
    type: "box", // other options are "box", "sphere", and 
    position: {
      x: 0,
      y: 2,
      z: 0
    },
    rotation: {
      x: 3,
      y: 1,
      z: 0
    },
    scale: {
      x: 1,
      y: 1,
      z: 1
    }
  }


function setup(){
    createCanvas(400,400);
}

function draw(){
    background(200,100,200);
}



