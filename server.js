require('dotenv').config({
	path: __dirname + '/.env'
});
const {
	google
} = require('googleapis');
const { GoogleSpreadsheet } = require("google-spreadsheet");
const docs = require('@googleapis/docs');
const express = require('express');
const mysql = require('mysql2');
const app = express();

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.GoogleAuth({
	process.env.CLIENT_EMAIL, process.env.PRIVATE_KEY, SHEETS_SCOPES});

//To create user on table (after making database):
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

async function running() {
	const authClient = await auth.getClient();
	console.log(authClient, "\n");

	const client = await docs.docs({
		version: 'v1',
		auth: authClient
	});

	const createResponse = await client.documents.create({
		requestBody: {
			title: 'Your new document!',
		},
	});

	console.log(createResponse.data);
}

/*
	Function create_main_log_object:
		input: sheet_id: the schedule_log sheet id, which we will save in the database for loading
		output: all_sheet_logs: the main log object of all the different forms they need filled out
			with their names and times of fillling out (daily, weekly, on incident, etc.)
*/
async function create_main_log_object(sheet_id) {
	// sign in to the specific doc that is serve to us
	let doc = new GoogleSpreadsheet(sheet_id);

	await doc.useServiceAccountAuth({
		client_email: process.env.CLIENT_EMAIL,
		private_key: process.env.PRIVATE_KEY
	});

	await doc.loadInfo();
	// pull all of the data from the spreadsheet to then parse through and make a return object
	let full_row_data = doc.sheetsByIndex[0].getRows();
	let all_sheet_logs = [];
	return all_sheet_logs;
}

app.get("/", (req, res) => {
	res.end("Dumby server!");
});

app.listen(3000, () => {
	console.log("server go vroom");
});