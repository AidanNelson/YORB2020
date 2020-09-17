## Server Setup For Multiple YORB Instances

On the server, we use Nginx for route requests to several instances of YORB running on separate ports.  There are some persnickety little configuration requirements for this, on the client side and in the Nginx configuration.  

The server was set up on a DigitalOcean host following [this guide](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-18-04) ([and](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-18-04) [all](https://www.digitalocean.com/docs/networking/dns/quickstart/) [prerequisite](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-18-04) [guides](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-18-04)).  

## Nginx Settings

That done, the domain specific settings for Nginx (i.e. `/etc/nginx/sites-available/yorb.itp.io`) were as follows:

```
server {

    server_name yorb.itp.io www.yorb.itp.io;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
            #try_files $uri $uri/ =404;
    }

    location /gmtwp/ {
        proxy_pass http://localhost:3010/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/yorb.itp.io/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/yorb.itp.io/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

server {
    if ($host = yorb.itp.io) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;

    server_name yorb.itp.io www.yorb.itp.io;
    return 404; # managed by Certbot
}
```

Note that the second location `/gmtwp/` and its corresponding proxy_pass location `http://localhost:3010/` require the trailing slash, which I didn't find well documented.

In order to get websockets to work with Nginx, I followed [this guide](https://www.nginx.com/blog/websocket-nginx/) and added the following 'map block' to the `/etc/nginx/nginx.conf` file (within the `http` block):

```
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```


## Socket.io Settings

By default, socket.io listens on the server at the `/socket.io/` path.  This means that any requests to the server must be made at this path (i.e. `wss://yorb.itp.io/socket.io/?EIO=3&transport=websocket&sid=574WlP6LJzJ5O8yCAABZ`).  Because our server is behind an Nginx reverse proxy server, we need to ensure that the client and socket server are listening on the same path.

On the server side, the setup is default, meaning it will listen at `http://localhost:3000/socket.io`:
```js
// HTTP Server setup:
// https://stackoverflow.com/questions/27393705/how-to-resolve-a-socket-io-404-not-found-error
var express = require('express'),
    http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.use(express.static(__dirname + "/public"));

server.listen(3000);
```

On the client side, however, we need to consider both the Nginx server and the final socket server.  In order that Nginx routes our requests to a specific location, we need to append a path to our request (i.e. `yorb.itp.io/myInstance`).  This path will then be stripped away by Nginx before it reaches our socket server:

Initial request (as seen by Nginx): `wss://yorb.itp.io/myInstance/socket.io/requestSettings`

Final request (as seen by our socket server): `wss://localhost:3000/socket.io/requestSettings`

*But* when we change from the default socket.io path to a custom path, we need to explicitly add /socket.io to the custom path such that the request path and the server listening path matched.  On the client side, that looks like this:
```js
socket = io('wss://yorb.itp.io', {
        path: "/myInstance/socket.io"
});
```

What a confusing setup...