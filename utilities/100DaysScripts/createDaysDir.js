// to get around fact that can't use fs.readdirSync in parcel, 
// running this script before build to generate the directory reference
// that daysGallery.js will use to require all post files
// is this insanely unneccesarry? is life itself? do I dare ask questions of the void?
// what if it answers?
// August 2020

//update: i no longer need this because apparently '/**' is a thing. keeping for reference

const fs = require('fs');
const path = require('path');

let assetPath = '../../src/assets/images/100Days/resized';
let postsDir = {};

fs.readdirSync(assetPath).forEach(account => {
    postsDir[account] = {};
    fs.readdirSync(path.join(assetPath, account)).forEach(date => { 
        // postsDir[account][date] = {posts: []};
        postsDir[account][date] = [];
        fs.readdirSync(path.join(assetPath, account, date)).forEach(post => {
            // postsDir[account][date]['posts'].push(post);
            postsDir[account][date].push(post);
        });
    });
});

let fileText = "module.exports = " + JSON.stringify(postsDir);

fs.writeFileSync('../../src/js/100Days/daysDir.js', fileText); //do i need to set encoding? default mode of write/truncate sounds fine