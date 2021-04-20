require('dotenv').config({
	path: __dirname + '/.env'
});
const {
	google
} = require('googleapis');
const {
	GoogleSpreadsheet
} = require("google-spreadsheet");
const docs = require('@googleapis/docs');
const express = require('express');
const mysql = require('mysql2');
const app = express();

const { edit_dist } = require("./utils.js");
// INTERNAL REPRASENTATION OF DAILY = 0, WEEKLY = 1, MONTHLY = 2, SEASONAL = 3, ANNUAL = 4, ONINCIDENT = 5, 
// ASNEEDED = 6, CORRECTIVEACTION = 7, RISKASSESMENT = 8, PREHARVEST = 9, DELIVERYDAYS = 10
const frequency_ofSubmission = {
	daily: 0, // a must submit
	weekly: 1, // must submit
	monthly: 2, // must submit
	seasonal: 3, // must submit
	annual: 4, // must submit
	onincident: 5,
	asneeded: 6,
	correctiveaction: 7,
	riskassesment: 8,
	preharvest: 9, // must submit
	deliverydays: 10 // must submit
}

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// const auth = new google.auth.GoogleAuth({
// 	process.env.CLIENT_EMAIL, process.env.PRIVATE_KEY, SHEETS_SCOPES});

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
	let full_row_data = await doc.sheetsByIndex[0].getRows();

	// create an array that can store object data for each value
	let all_sheet_logs = [];
	full_row_data.forEach((log_row) => {
		//console.log("\n\n", log_row._rawData);
		// run through all the log data
		// find the ones that have at least 3 items (meaning they have enough data to qualify)
		if (log_row._rawData[0] && log_row._rawData[0].length && log_row._rawData[2] && log_row._rawData[2].length) {
			log_row._rawData[2] = log_row._rawData[2].toLowerCase().replace(/[^a-z]/g, "");
			// find what log_row._rawData[2] (the frequency of submission) is closest to (fuzzy wuzzy it)

			let temporary_item;
			let lowest_fuzzy = 10000;
			Object.keys(frequency_ofSubmission).forEach((item) => {
				// compare item and see which we will choose
				let distance = edit_dist(log_row._rawData[2], item);
				if (lowest_fuzzy > distance) {
					temporary_item = item;
					lowest_fuzzy = distance;
				}
			});
			log_row._rawData[2] = frequency_ofSubmission[temporary_item];

			// otherwise we need to encapsulate the important data into an object
			all_sheet_logs.push({
				file_name: log_row._rawData[0],
				frequency_ofSubmission: log_row._rawData[2]
			});
		}
	});
	return all_sheet_logs;
}

create_main_log_object("1eao1E4mzLu4oXINDrezLIf8pOQh6L4J9LdUAgfOpYaw").then((sheet_answer) => {
	console.log(sheet_answer);
});

/* Function check_status
	inputs- farmer_sheet_log_value: the farmers log sheet value (at specific id) that checks the file and sees when they might need to submit it
				The idea with that being that it only cares for certain values:
					1. daily = 0
					2. weekly = 1
					3. monthly = 2
					4. seasonal = 3
					5. annual = 4
					6. preharvest = 9
					7. deliverydays = 10
			sheet_id: the id of the sheet we need to check for these values (we would know what it's value is based on farmer_sheet_log)
	functionality- check if they have submitted this form for their current values
------------------ need to update the value on their status page based on that, a very similar function could be used for sending status reports
	output- status: either "need submission" or "completed"
*/
function check_status(farmer_sheet_log_value, sheet_id) {
	// load in the sheet
	let doc = new GoogleSpreadsheet(sheet_id);

	await doc.useServiceAccountAuth({
		client_email: process.env.CLIENT_EMAIL,
		private_key: process.env.PRIVATE_KEY
	});

	await doc.loadInfo();
}

app.get("/", (req, res) => {
	res.end("Dumby server!");
});

app.listen(3000, () => {
	console.log("server go vroom");
});