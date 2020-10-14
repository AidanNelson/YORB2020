## YORB 2020 could use **your** help!  *Mine?*  Yes, yours!  

## Local Developement Setup:


1. Clone or fork the repository and download a local copy:
    ```bash
    git clone https://github.com/AidanNelson/YORB2020.git
    ```
2. Navigate into the repository and install dependencies (note that it may take some time to build Mediasoup):
    ```bash
    cd YORB2020
    npm install
    ```
3. YORB relies on a secure (HTTPS) server, and as such requires that you set up certificates.  On MacOS, you can run the following commands to generate self-signed certificates.  These certificates will work for local development:
    ```bash
    mkdir certs
    openssl req  -nodes -new -x509  -keyout certs/privkey.pem -out certs/fullchain.pem
    ```
4. Create a `.env` file following the `example.env` example:
    ```
   PRODUCTION_IP="YOUR.LOCAL.NETWORK.IP" 
   PRODUCTION_PORT="3000"
   DEBUG = "demo-app*"
   ```
   If you'd like to connect to the yorb.itp.io backend, use this `.env` configuration:
    ```
   PRODUCTION_IP="yorb.itp.io" 
   PRODUCTION_PORT="443"
   DEBUG = "demo-app*"
   ```
5. Create a new branch with a unique name and start developing:
    ```bash
    git checkout -b add-cool-feature
    ```
6. Add a new js folder for the program to put the bundle files:
    ```
    mkdir public/js
    ```    
7. Start the build system and node server:
    ```
    sudo npm start
    ```
