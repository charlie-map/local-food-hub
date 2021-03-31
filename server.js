require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mysql = require('mysql2');
const app = express();

//To create user on tabel (after making databse):
//CREATE USER 'foodhubuser'@'localhost' IDENTIFIED BY '0f28901b-2644-4109-ab06-21f55d49438f';
//GRANT ALL PRIVILEGES ON foodhub.* TO 'foodhubuser'@'localhost';
//FLUSH PRIVILEGES;
const connection = mysql.createConnection({
	host: process.env.HOST,
	database: process.env.DATABASE,
	user: process.env.FOOD_USER,
	password: process.env.PASSWORD,
	insecureAuth: false
});

connection.connect((err) => {
	if (err) throw err;
});

app.get("/", (req, res) => {
	res.end("Dumby server!");
});

app.listen(3000, () => {
	console.log("server go vroom");
});