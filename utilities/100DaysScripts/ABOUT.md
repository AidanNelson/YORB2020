# Instagram Scraper for 100 Days Gallery in YORB

*not sure where best to put this readme and the corresponding files, so for now keeping most of it in utilities while the module is in /js and the scrapes/resizes are in assets/images/100Days*

NOTE: If you don't have images in the corresponding folders the YORB will still build but it'll throw a bunch of errors in the console, just ignore them. If you want to run your local YORB with the scrapes, reach out to me (August) and I can walk you through the steps.

### To-Do: Deploy
- [X] Update path in cron tab line (sudo crontab -e)
- [X] install instagram-scraper (python)
- [X] add cron tab line to YORB machine (check time of classes)
- [X] add accounts to accounts.txt
- [X] add assets folders since in .gitignore
- [X] create YORBOT account
- [X] follow class

### To-Do: Develop
- [X] resize script (images)
- [-] resize script (videos) (ffmpeg?)
- [X] resize script to account for rect posts (contain)
- [ ] make sure there's a valid post to display -- error with no content length...
- [ ] smaller avatars/zig zag gallery?
- [X] try bigger resolution
- [ ] try diff file types
- [X] filter by hashtag
- [X] filter by case sensitive hashtag...
- [X] 100Days module
- [X] YORB test
- [X] nameplate above canvas
- [X] fix class sorting in files
- [X] click/interact to get link to insta
- [ ] fancier click menu
- [X] need to separate students by class?
- [ ] have HD images/videos served on command from other server like the projectDatabase
- [ ] *optional* would be cool to have some sort of structure outside that gets bigger with each post
- [X] maybe develop a placement tool for the overall project based on placeClockwise

## Order of Operations

1. Daily cron job that runs the scraper
2. Resize the scraper files
3. Pull from the resized files to generate the image textures in the YORB
4. Update the build


### Cron Job: scrape & resize
template: 

```
M H * * * cd /var/local/experimental/utilities/100DaysScripts/ && sudo -u august instagram-scraper -f accounts_<CLASS>.txt -u <user> -p <pass> -d ../../src/assets/images/100Days/scrapes/<CLASS> -n --filter nyudaily -t image video --latest-stamps latestScrapes.txt -T {date}-{shortcode}-{urlname} > /var/local/experimental/utilities/100DaysScripts/cron<CLASS>.log 2>&1 ; sudo -u august instagram-scraper -f accounts_<CLASS>.txt -u <user> -p <pass> -d ../../src/assets/images/100Days/scrapes/<CLASS> -n --filter NYUdaily -t image video --latest-stamps latestScrapes.txt -T {date}-{shortcode}-{urlname} > /var/local/experimental/utilities/100DaysScripts/cron<CLASS>.log 2>&1 ; cd /var/local/experimental/ && node utilities/100DaysScripts/resizeScrapes.js >> /var/local/experimental/utilities/100DaysScripts/cron<CLASS>.log 2>&1 ; cd /var/local/experimental && npm run build >> /var/local/experimental/utilities/100DaysScripts/cron<CLASS>.log 2>&1 
``` 


### Manual run:
```
cd /var/local/experimental/utilities/100DaysScripts/ && sudo instagram-scraper -f accounts_kd.txt -u <USER> -p <PASS> -d ../../src/assets/images/100Days/scrapes/kd -n -m 50 --filter nyudaily -t image video --latest-stamps latestScrapes.txt -T {date}-{shortcode}-{urlname}

cd /var/local/experimental/utilities/100DaysScripts/ && sudo instagram-scraper -f accounts_kc.txt -u <USER> -p <PASS> -d ../../src/assets/images/100Days/scrapes/kc -n -m 50 --filter nyudaily -t image video --latest-stamps latestScrapes.txt -T {date}-{shortcode}-{urlname}

cd /var/local/experimental/utilities/100DaysScripts/ && sudo instagram-scraper -f accounts_paula.txt -u <USER> -p <PASS> -d ../../src/assets/images/100Days/scrapes/paula -n -m 50 --filter nyudaily -t image video --latest-stamps latestScrapes.txt -T {date}-{shortcode}-{urlname}

cd /var/local/experimental && sudo node utilities/100DaysScripts/resizeScrapes.js

sudo npm run build
```


