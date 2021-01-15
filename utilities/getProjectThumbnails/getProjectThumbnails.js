/*
* This script will download, resize and save the project images from the ITP Project Database for a given venue ID
* Aidan Nelson, 2020
*
*/

let VENUE_ID = 165;

let url = `https://itp.nyu.edu/projects/public/projectsJSON_ALL.php?venue_id=${VENUE_ID}`

var https = require('https');
var Stream = require('stream').Transform;
var fs = require('fs');
const sharp = require('sharp');

let projects;

async function getProjects() {
    return new Promise((resolve, reject) => {
        https.get(url, function (res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                if (res.statusCode === 200) {
                    try {
                        projects = JSON.parse(body);
                        // data is available here:
                        console.log("Got projects!");
                        resolve();
                    } catch (e) {
                        console.log('Error parsing JSON!');
                        console.log(e);
                    }
                } else {
                    console.log('Status:', res.statusCode);
                }
            });
        }).on('error', function (err) {
            console.log('Error:', err);
            reject();
        })
    });
}

async function main() {
    await getProjects();

    for (let i = 0; i < projects.length; i++) {
    // for (let i = 0; i < 20; i++) {
        let projectImage = projects[i].image;
        let url = "https://itp.nyu.edu/" + projectImage;
        let filename = projects[i].project_id;

        if (projectImage == "noimage.png") {
            continue;
        } else {
            downloadAndProcessImage(url, filename);
        }
    }

}

main();


// https://stackoverflow.com/questions/12740659/downloading-images-with-node-js
function downloadAndProcessImage(url, filename) {
    https.request(url, function (response) {
        var data = new Stream();

        response.on('data', function (chunk) {
            data.push(chunk);
        });

        response.on('end', function () {
            // sharp(data.read())
            //     .toFile('images/' + filename + '.png', (err, info) => {
            //         console.log(err);
            //         console.log(info);
            //     });
            sharp(data.read())
                .resize(256,256)
                .toFile('project_thumbnails/' + filename + '.png', (err, info) => {
                    console.log(err);
                    console.log(info);
                });
        });
    }).end();
}