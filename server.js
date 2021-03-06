require('dotenv').config({
    path: __dirname + '/.env'
});
const mustacheExpress = require("mustache-express");
const express = require('express');
const saltRounds = 10;

// pull dependencies
const {
    edit_dist,
    isLoggedIn,
    bcrypt,
    connection,
    utilities
} = require('./utils.js');
const {
    create_main_log_object
} = require('./google.utils.js');
const router = require('./router');

const app = express();

const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const {
    v4: uuidv4
} = require("uuid");


app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.set('views', __dirname + "/views");
app.set('view engine', 'mustache');
app.engine('mustache', mustacheExpress());
app.use('/', router);
app.use('/', utilities);

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
    response.sendFile(__dirname + "/views/login.html");
});
//could be some bugs with /login--I think the page isn't what we intended. I think "/" is what we've interpreted as /login
app.post("/login", function(req, res) {
    connection.query('SELECT * FROM farmers WHERE username=?', [req.body.username], (err, row) => {
        if (err || row.length == 0) {
            res.sendFile(__dirname + '/views/login.html');
            return;
        }
	console.log(row);
        bcrypt.compare(req.body.psw, row[0].password, function(err, result) {
		console.log("COMPARING", result);
            if (result) {
                let now = new Date();
                now.setSeconds(now.getSeconds() + 3600);
                let token = uuidv4();
                //we need to remove the old tokens first--if they exist 
                connection.query('DELETE FROM uuid WHERE farmer_id=? OR farmer_id IS NULL', [row[0].id], (err) => {
                    if (err) console.log(err);
                    connection.query('INSERT INTO uuid(token, farmer_id, expiry) values(?,?,?)', [token, row[0].id, now], (err) => {
                        if (err) console.log(err);
                        res.cookie("token", token);
			console.log("made token");
                        if (row[0].account_type == 0) {
                            res.redirect('/farm/view-status?username=' + req.body.username);
                        } else {
                            //if accounttype !0, send to admin
                            res.redirect('/admin');
                        }
                    });
                });
            } else {
                res.sendFile(__dirname + '/views/login.html');
                return;
            }

        });
    });

});

app.get("/logout", isLoggedIn, (req, res) => {
    //access the data base uuid
    connection.query('SELECT * FROM farmers WHERE farm_name = ?', [req.username], (err, row) => {
        //delete from row which now exists from the previous connection.

        //currently breaking because it doesn't know "id"
        connection.query('DELETE FROM uuid WHERE farmer_id = ?', [row[0].farmer_id], (err) => {
            res.cookie('token', 'whatever', {
                expires: new Date(Date.now(0))
            });
            res.redirect("/views/login.html");
            res.end("thanks!");
        });
    });
});


// '/secret' = status page. Status page should have logout buttont that goes to ^^^
// app.get("/secret", isLoggedIn, function(req, res) {
//     // res.redirect('/logout');
//     res.end("hello" + " " + req.username);
//     //res.redirect('/homebase');
// });
app.listen(process.env.PORT, () => {
    console.log("server go vroom");
});
