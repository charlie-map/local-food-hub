require('dotenv').config({
	path: __dirname + '/.env'
});
//defining new variables for the file ID portion of the project
const path = require('path');

const _SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];

const NodeGoogleDrive = require('node-google-drive-new');
const YOUR_ROOT_FOLDER = '1gTpKQ1eFgI5iU5TT0_3A4NJUs4D2zD9w',
	PATH_TO_CREDENTIALS = path.resolve(`${__dirname}/key.json`);
//^^ I and Z addition to vars in case looking for what might be new

const {
	google
} = require('googleapis');
const drive = google.drive('v2');
// create a drive access
const auth = new google.auth.GoogleAuth({
	keyFilename: 'key.json',
	scopes: _SCOPES[1]
});
let authClient;
async function create_client() {
	authClient = await auth.getClient()
}

create_client().then(() => {
	google.options({
		auth: authClient
	});
});

const {
	GoogleSpreadsheet
} = require('google-spreadsheet');

const docs = require('@googleapis/docs');
const express = require('express');
const mysql = require('mysql2');
const app = express();
const {
	edit_dist
} = require("./utils.js");

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

// To create user on table (after making database):
// CREATE USER 'foodhubuser'@'localhost' IDENTIFIED BY '0f28901b-2644-4109-ab06-21f55d49438f';
// GRANT ALL PRIVILEGES ON foodhub.* TO 'foodhubuser'@'localhost';
// FLUSH PRIVILEGES;

//
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

async function pull_files(googleDriveInstance, main_folder_id, pull_recursive) {
	return new Promise(async (resolve, reject) => {
		let fileList = await googleDriveInstance.list({
			fileId: main_folder_id,
			recursive: pull_recursive
		})
		resolve(fileList);
	});
}

function find_id(all_files, file_name, submission_frequency) {
	let lowest_fuzzy = 10000,
		curr_distance, first_letter_dist;
	let file_id, return_file_name, return_dist, return_status;
	all_files.files.forEach((file) => {
		curr_distance = edit_dist(file.name.trim(), file_name);
		first_letter_dist = edit_dist(file.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 5), file_name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 5));
		if (curr_distance < lowest_fuzzy && first_letter_dist < 3) {
			lowest_fuzzy = curr_distance;
			file_id = file.id;
			return_file_name = file.name.trim();
		}
	});

	// find file_id, go into said file and look at the history of the document to consider if it needs submition
	// check submission frequency to see if it's needed
	// onincident: 5, asneeded: 6, correctiveaction: 7, riskassesment: 8 <---- NO SUBMISSION needed
	if (!file_id || frequency_ofSubmission[submission_frequency] == 5 || frequency_ofSubmission[submission_frequency] == 6 || frequency_ofSubmission[submission_frequency] == 7 || frequency_ofSubmission[submission_frequency] == 8)
		return [file_id, false, return_file_name];
	return [file_id, true, return_file_name];
}

/*
	Function create_main_log_object:
		input: sheet_id: the schedule_log sheet id, which we will save in the database for loading
		output: all_sheet_logs: the main log object of all the different forms they need filled out
			with their names and times of fillling out (daily, weekly, on incident, etc.)
*/
async function create_main_log_object(folder_id) {
	const creds_service_user = require(PATH_TO_CREDENTIALS);
	const googleDriveInstance = new NodeGoogleDrive({
		ROOT_FOLDER: folder_id
	});

	let gdrive = await googleDriveInstance.useServiceAccountAuth(creds_service_user);

	let root_files = await pull_files(googleDriveInstance, folder_id, false);
	let mainlog_sheet_id = "";
	root_files.files.forEach((item) => {
		if (edit_dist(item.name.substring(item.name.length - 12).toLowerCase().replace(/[^a-z]/g, ""), "logschedule") < 3)
			mainlog_sheet_id = item.id;
	});
	root_files = await pull_files(googleDriveInstance, folder_id, true);

	let doc = new GoogleSpreadsheet(mainlog_sheet_id);
	await doc.useServiceAccountAuth({
		client_email: process.env.CLIENT_EMAIL,
		private_key: process.env.PRIVATE_KEY
	});
	await doc.loadInfo();

	// pull all of the data from the spreadsheet to then parse through and make a return object
	let full_row_data = await doc.sheetsByIndex[0].getRows();
	// create an array that can store object data for each value

	let all_sheet_logs = [];
	full_row_data.forEach(async (log_row, index) => {
		if (index < 2) {
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

				log_row._rawData[2] = temporary_item;
				// otherwise we need to encapsulate the important data into an object
				let return_values = find_id(root_files, log_row._rawData[0], log_row._rawData[2]);
				let token = undefined;
				let edits = [];
				if (!return_values[1]) {
					do {
						// find the actual revisions
						let res = await drive.revisions.list({
							fileId: return_values[0],
							pageToken: token
						});
						edits = [...edits, ...res.data.items];
						token = res.data.nextPageToken ? res.data.nextPageToken : null;
					} while (token);

					// grab the final position in edits and see when it was made compared to the _rawData[2]
					let modifiedDate = edits[edits.length - 1].modifiedDate;
					console.log(modifiedDate);

					// 1. daily = 0 ---- every day at 6am (weekends?)
					// 2. weekly = 1 ---- mondays at 6am
					// 3. monthly = 2 ---- first monday of month at 6am
					// 4. seasonal = 3 ---- when should this be due?
					// 5. annual = 4 ---- first monday of new year at 6am
					// 6. preharvest = 9 ---- august 10th
					// 7. deliverydays = 10 ---- friday and monday at 6am

				}

				all_sheet_logs.push({
					file_name: log_row._rawData[0],
					fileID: return_values[0],
					status: return_values[1],
					frequency_ofSubmission: frequency_ofSubmission[log_row._rawData[2]]
				});
			}
		}
	});
	return all_sheet_logs;
}

create_main_log_object(YOUR_ROOT_FOLDER).then((sheet_answer) => {
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
			mainlog_sheet_id: the id of the sheet we need to check for these values (we would know what it's value is based on farmer_sheet_log)
	functionality- check if they have submitted this form for their current values
------------------ need to update the value on their status page based on that, a very similar function could be used for sending status reports
	output- status: either "need submission" or "completed"
*/

app.get("/", (req, res) => {
	res.end("Dumby server!");
});

app.listen(8080, () => {
	console.log("server go vroom");
});