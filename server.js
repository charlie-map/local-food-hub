require('dotenv').config({
	path: __dirname + '/.env'
});
const mustacheExpress = require("mustache-express");
const express = require('express');
// pull dependencies
const {
	edit_dist,
	isLoggedIn,
	connection
} = require('./utils.js');
const {
	create_main_log_object
} = require('./google.utils.js');
const router = require('./router');

const app = express();

const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const {
    uuid
} = require("uuidv4");


app.use(express.static(__dirname + "/public"));
app.use('/',router);
app.set('view engine', 'mustache');
app.engine('mustache', mustacheExpress());



// create_main_log_object('1gTpKQ1eFgI5iU5TT0_3A4NJUs4D2zD9w').then((sheet_answer) => {
// 	console.log("test", sheet_answer);
// 	// console.log(curr_distance < lowest_fuzzy, first_letter_dist < 3, file.mimeType.split(".")[file.mimeType.split(".").length - 1] == "form");
// });

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/views/admin.html");
});

//login stuff
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
    response.sendFile(__dirname + "/views/index.html");
});
//could be some bugs with /login--I think the page isn't what we intended. I think "/" is what we've interpreted as /login
app.post("/login", function(req, res) {
    connection.query('SELECT * FROM user WHERE username = ?', [req.body.username], (err, row) => {
        console.log(row);
        if (err || row.length == 0) {
            res.redirect('/');
            return;
        }
        if (row[0].password == req.body.password) {
            let now = new Date();
            now.setSeconds(now.getSeconds() + 3600);
            let token = uuid();
            //we need to remove the old tokens first--if they exist 
            connection.query('DELETE FROM uuid WHERE id = ?', [row[0].farmer_id], (err) => {
                connection.query('INSERT INTO uuid(token, id, expiry) values(?,?,?)', [token, row[0].farmer_id, now], (err) => {
                    res.cookie("token", token);
                    res.redirect('/farms/view-status');

                });

            });

        } else {
            res.redirect('/');
            return;
        }
    });

});

app.get("/logout", isLoggedIn, (req, res) => {
    //access the data base uuid
    connection.query('SELECT * FROM user WHERE username = ?', [req.username], (err, row) => {
        //delete from row which now exists from the previous connection.

        //currently breaking because it doesn't know "id"
        connection.query('DELETE FROM uuid WHERE farmer_id = ?', [row[0].farmer_id], (err) => {
            res.cookie('token', 'whatever', {
                expires: new Date(Date.now(0))
            });
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
app.listen(8080, () => {
	console.log("server go vroom");
});
