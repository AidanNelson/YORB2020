/**
 *  Resizes the instagram scrapes a la getProjetThumbnail.js by Aidan
 * 
 *  August Luhrs Jan 2020
 * 
 *  for each account folder, get file, resize, save to new file based on timestamp from original scrape
 *  also renaming old scrapes so don't have redundant resizes on subsequent runs
 * 
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootPath = process.cwd(); //working directory
const scrapesFolder = path.join(rootPath, 'src/assets/images/100Days/scrapes');
const resizedFolder = path.join(rootPath, 'src/assets/images/100Days/resized');

// let accountFolders = [];

//go through each class/account/date, resize the posts based on img or vid, and add them to new resized folder
fs.readdirSync(scrapesFolder).forEach(classroom => {
    fs.readdirSync(path.join(scrapesFolder, classroom)).forEach(account => {
        //also need to make account dir in resized if it doesn't already exist
        if (!fs.existsSync(path.join(resizedFolder, classroom, account))){
            fs.mkdirSync(path.join(resizedFolder, classroom, account));
        }
        
        //check each file in the account for resizes
        fs.readdirSync(path.join(scrapesFolder, classroom, account)).forEach(fileName => {
            //for each account, ignore the posts that have already been resized and labeled with "old"
            if(!fileName.includes('old')){ //no longer using, but keeping for now
                //location of original
                let originalPath = path.join(scrapesFolder, classroom, account);

                //make a folder per day so we can sort by date
                let day = fileName.substr(0, 8); //the beginning of each file is the date of post
                let dayFolder = path.join(resizedFolder, classroom, account, day);
                
                //if it's a new date, make the folder
                if(!fs.existsSync(dayFolder)) {
                    fs.mkdirSync(dayFolder);
                }
                
                //name the file sequentially based on existing posts from that day
                let existingNum = fs.readdirSync(dayFolder).length;
    
                if(fileName.includes('.jpg')) { //its an image
                    //resize the image and save to the resized folder (png for now)
                    sharp(path.join(originalPath, fileName))
                    .resize(1024, 1024, {fit: 'contain'})
                    .toFile(path.join(dayFolder, existingNum + '.png'), (err, info) => {
                        if (err) {
                            console.log('ERROR at ' + folder.path + '/' + fileName + " : " + err);
                        } else {
                            // won't skip files that haven't actually been resized
                            // rename old file so won't trigger on subsequent runs
                            // fs.renameSync(path.join(originalPath, fileName), path.join(originalPath, 'old' + fileName));
                            // now using --latest-stamps so safe to delete
                            fs.unlinkSync(path.join(originalPath, fileName)); //rmSync didn't work
                        }
                        if (info) {
                            console.log("INFO at " + dayFolder + " : " + info);
                        }
                    })
                } else { //its a video -- resize not needed? not removing, just moving to resized folder
                    // fs.copyFileSync(path.join(originalPath, fileName), path.join(originalPath, 'old' + fileName));     
                    fs.renameSync(path.join(originalPath, fileName), path.join(dayFolder, existingNum + '.mp4'));
                    // fs.rmSync(path.join(originalPath, fileName));
                    
                }
            }
        });
    });
});

/* OLD DUMB WAY

//for each class and account folder, make an object that has that account and all the post files saved in that dir

fs.readdirSync(scrapesFolder).forEach(classDir => {
    fs.readdirSync(path.join(scrapesFolder, classDir)).forEach(dirName => {
        let accountDir = path.join(scrapesFolder, classDir, dirName);
        let posts = fs.readdirSync(accountDir);
        accountFolders.push({path: accountDir, class: classDir, account: dirName, posts: posts}); 

        //also need to make account dir in resized if it doesn't already exist
        if (!fs.existsSync(path.join(resizedFolder, classDir, dirName))){
            fs.mkdirSync(path.join(resizedFolder, classDir, dirName));
        }
    });
});

console.log(accountFolders);

for (let folder of accountFolders) {
    fs.readdirSync(folder.path).forEach(fileName => {
        console.log(path.join(folder.path, fileName));
        //check for old posts
        if(!fileName.includes('old')){
            //make a folder per day so we can sort by date
            let day = fileName.substr(0, 8);
            let dayFolder = path.join(resizedFolder, folder.class, folder.account, day);
            if(!fs.existsSync(dayFolder)) {
                fs.mkdirSync(dayFolder);
            }

            //name the file sequentially based on existing posts from that day
            let existingNum = fs.readdirSync(dayFolder).length;

            if(fileName.includes('.jpg')) { //its an image
                //resize the image and save to the resized folder
                sharp(path.join(folder.path, fileName))
                // .resize(256, 256)
                .resize(1024, 1024, {fit: 'contain'})
                .toFile(path.join(dayFolder, existingNum + '.png'), (err, info) => {
                    if (err) {
                        console.log('ERROR at ' + folder.path + '/' + fileName + " : " + err);
                    } else {
                        //moving this here so won't skip files that haven't actually been resized
                        //rename old file so won't trigger on subsequent runs
                        fs.renameSync(path.join(folder.path, fileName), path.join(folder.path, 'old' + fileName));
                    }
                    if (info) {
                        console.log("INFO at " + dayFolder + " : " + info);
                    }
                })
            } else { //its a video -- TODO: figure out resize
                //for now just add 'old' and move to the resized folder even though it hasn't been resized
                fs.copyFileSync(path.join(folder.path, fileName), path.join(folder.path, 'old' + fileName));     
                fs.renameSync(path.join(folder.path, fileName), path.join(dayFolder, existingNum + 'needsResize.mp4')); //hopefully can use .includes('needsResize') to do this later
            }
        }
    });
}
*/