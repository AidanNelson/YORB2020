## YORB 2020 could use **your** help!  *Mine?*  Yes, yours!  

If you want to run the code locally, you can do so against either the ITP Yorb server or a local server.  If you want to change things on the "front end" (i.e. the style, objects in the space, the way people are shown in the space, the way the floor is laid out, etc.) but don't need to do any "server-side development," you can do so by following the first set of instructions here:

## Local Developement Setup (Front End)

1. Clone or fork the repository and download a local copy:
    ```bash
    git clone https://github.com/yorb-club/YORB2020.git
    ```
2. Navigate into the repository and install dependencies:
    ```bash
    cd YORB2020
    npm install
    ```
3. Create a new branch with a unique name and start developing:
    ```bash
    git checkout -b add-cool-feature
    ```
4. Start the build system which includes a local development server:
    ```bash
    npm run watch
    ```
5. Navigate your browser window to http://localhost:1234
6. Note that you may need to restart this local development server / build system from time to time to ensure that your changes are being reflected in the browser!


## Local Development Setup (Server-Side Development)

1. Follow steps 1 - 3  from above, 
2. Change the following variables in the `src/js/index.js` file to point to your local development server like this:
    ```js
    // For running against local server
    const WEB_SOCKET_SERVER = "localhost:3000";
    const INSTANCE_PATH = "/socket.io";

    // For running against ITP server
    // const WEB_SOCKET_SERVER = "https://yorb.itp.io";
    // const INSTANCE_PATH = "/experimental/socket.io";
    ```

3. Change directory in your terminal into the `/server` folder and install all required dependencies:
    ```bash
    cd server
    npm install
    ```
4. Create a new file in the `/server` folder called `.env` and copy the contents of `example.env` into it.  Adjust the `PRODUCTION_IP` to reflect your computer's IP address on the local network:
    ```
    PROJECT_DATABASE_URL = 'https://itp.nyu.edu/projects/public/projectsJSON_ALL.php?venue_id=164&room_id=1'    
    PRODUCTION_IP="192.168.0.107"
    PRODUCTION_PORT="3000"
    ```
5. Change directory again back to the root directory of the project and start the server:
    ```bash
    cd ..
    npm run start-server
    ```
6. In a separate terminal window (in the root directory of the project), start the build system (same as step #4 from above):
    ```bash
    npm run watch
    ```
7. Navigate your browser window to http://localhost:1234.  This page should now connect to your backend server at http://localhost:3000.
8. Note that you may need to restart this local development server / build system from time to time to ensure that your changes are being reflected in the browser!
