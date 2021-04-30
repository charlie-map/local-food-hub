require('dotenv').config({
	path: __dirname + '/.env'
});
const mustacheExpress = require("mustache-express");
const express = require('express');

// pull dependencies
const {
	edit_dist,
	connection
} = require('./utils.js');
const {
	create_main_log_object
} = require('./google.utils.js');

const router = require('./router');

const app = express();

app.use(express.static(__dirname + "/public"));
app.use('/',router);
app.set('view engine', 'mustache');
app.engine('mustache', mustacheExpress());

create_main_log_object('1gTpKQ1eFgI5iU5TT0_3A4NJUs4D2zD9w').then((sheet_answer) => {
	console.log("test", sheet_answer);
	// console.log(curr_distance < lowest_fuzzy, first_letter_dist < 3, file.mimeType.split(".")[file.mimeType.split(".").length - 1] == "form");
});

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/views/admin.html");
});

app.listen(8080, () => {
	console.log("server go vroom");
});
