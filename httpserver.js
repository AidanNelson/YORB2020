const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.redirect("https://yorb.itp.io/");
});

app.listen(80, () => console.log('Listening on port 80!'));