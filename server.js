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
const app = express();
const {
	edit_dist,
	connection
} = require("./utils.js");

// Pull date libraries:
const Sugar = require('sugar');
const spacetime = require('spacetime');
const moment = require('moment');

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

const router = require('./admin');

app.use('/', router);

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

async function pull_main_logs(googleDriveInstance, main_folder_id) {
	return new Promise(async (resolve, reject) => {
		// find all big logs copies by first pulling out each file in the main_log
		let fileList = await pull_files(googleDriveInstance, main_folder_id, false);

		let return_sheets = [];
		// find each folder name
		let promiseBound = fileList.files.map(async (item) => {
			if (item.mimeType.split(".")[item.mimeType.split(".").length - 1] == "folder") {

				// grab folder name, then search for the spreadsheet within there
				let inner_files = await pull_files(googleDriveInstance, item.id, false);

				// find the one most related to "[name] Completed Logs"
				for (let find_name = 0; find_name < inner_files.files.length; find_name++) {
					if (edit_dist(item.name.toLowerCase(), inner_files.files[find_name].name.toLowerCase().substring(0, item.name.length)) < 3) {
						return_sheets.push(inner_files.files[find_name]);
						return;
					}
				}
			}
		});
		Promise.all(promiseBound).then(() => {
			resolve(return_sheets);
		});
	});
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
	let main_logs = await pull_main_logs(googleDriveInstance, folder_id);
	//console.log(main_logs);

	let doc = new GoogleSpreadsheet(mainlog_sheet_id);
	await doc.useServiceAccountAuth({
		client_email: process.env.CLIENT_EMAIL,
		private_key: process.env.PRIVATE_KEY
	});
	await doc.loadInfo();

	// pull all of the data from the spreadsheet to then parse through and make a return object
	await doc.sheetsByIndex[0].loadHeaderRow();
	if (doc.sheetsByIndex[0].headerValues[doc.sheetsByIndex[0].headerValues.length - 1] != "Times") await doc.sheetsByIndex[0].setHeaderRow([...doc.sheetsByIndex[0].headerValues, "Times"]);
	let full_row_data = await doc.sheetsByIndex[0].getRows();

	let frequency_position;
	for (frequency_position = 0; frequency_position < full_row_data.length; frequency_position++) {
		if (full_row_data[frequency_position]._rawData[full_row_data[frequency_position]._rawData.length - 2] && edit_dist(full_row_data[frequency_position]._rawData[full_row_data[frequency_position]._rawData.length - 2], "Frequency") < 2)
			break;
	}

	// 1, 2, 3, 6, 7
	let all_dates = [];

	let daily_value = full_row_data[frequency_position + 3]._rawData[full_row_data[frequency_position + 3]._rawData.length - 1].toLowerCase().split(/[ :]+/);
	daily_value[0] = daily_value[1] == "pm" ? parseInt(daily_value[0], 10) + 12 : parseInt(daily_value[0], 10) + 0;
	all_dates[0] = ["daily", new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), daily_value[0])];
	all_dates[0][1] = Sugar.Date.isFuture(all_dates[0][1]) ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 7, daily_value[0]) : all_dates[0][1];

	let weekly_value = new Date(moment().day(full_row_data[frequency_position + 2]._rawData[full_row_data[frequency_position + 2]._rawData.length - 1]));
	weekly_value = new Date(new Date(weekly_value).getFullYear(), new Date(weekly_value).getMonth(), new Date(weekly_value).getDate(), daily_value[0]);
	weekly_value = Sugar.Date.isFuture(weekly_value) ? new Date(new Date(weekly_value).getFullYear(), new Date(weekly_value).getMonth(), new Date(weekly_value).getDate() - 7, daily_value[0]) : new Date(new Date(weekly_value).getFullYear(), new Date(weekly_value).getMonth(), new Date(weekly_value).getDate(), daily_value[0]);
	all_dates[1] = ["weekly", weekly_value];

	// get first week of this month
	let monthly_value = new Date(moment().day(full_row_data[frequency_position + 3]._rawData[full_row_data[frequency_position + 3]._rawData.length - 1]));
	monthly_value = new Date(monthly_value.getFullYear(), monthly_value.getMonth(), Math.round((monthly_value.getDate() + 1) % 7), daily_value[0]);

	all_dates[2] = ["monthly", monthly_value];
	all_dates[3] = ["seasonal", spacetime.now().quarter()];
	for (let days = 1; days < 8; days++) { // find first monday of year
		all_dates[4] = ["annual", new Date(new Date().getFullYear(), 0, days, daily_value[0])];
		if (all_dates[4][1].getDay() == 1)
			break;
	}
	let preharvest_date = Sugar.Date.create(full_row_data[frequency_position + 6]._rawData[full_row_data[frequency_position + 6]._rawData.length - 1]);
	while (Sugar.Date.isFuture(preharvest_date)) {
		preharvest_date = new Date(preharvest_date.getFullYear() - 1, preharvest_date.getMonth(), preharvest_date.getDate(), daily_value[0]);
	}
	all_dates[5] = ["preharvest", preharvest_date];
	all_dates[6] = ["deliverydays", full_row_data[frequency_position + 7]._rawData[full_row_data[frequency_position + 7]._rawData.length - 1].replace(/[ ]/g, "").split("and")]; // full_row_data[frequency_position + 7]._rawData[full_row_data[frequency_position + 7]._rawData.length - 1].replace(/[ ]/g, "").split("and")];

	// get dates of each of these objects using sugarjs

	let temp_sugar;
	if (Array.isArray(all_dates[6][1])) {
		all_dates[6][1].forEach((each_day, indeces) => {
			temp_sugar = Sugar.Date.create("last " + each_day);
			all_dates[6][indeces] = Sugar.Date.isValid(temp_sugar) ? temp_sugar : new Date(moment().day(each_day));
			all_dates[6][indeces] = new Date(all_dates[6][indeces].getFullYear(), all_dates[6][indeces].getMonth(), all_dates[6][indeces].getDate(), daily_value[0]);
		});
	}

	console.log(all_dates);

	// 1. daily = 0 ---- every day at 6am (weekends?)
	// 2. weekly = 1 ---- mondays at 6am
	// 3. monthly = 2 ---- first monday of month at 6am
	// 4. seasonal = 3 ---- start of new season (first monday of 6am)
	// 5. annual = 4 ---- first monday of new year at 6am
	// 6. preharvest = 5 ---- august 10th
	// 7. deliverydays = 6 ---- friday and monday at 6am

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



				// compare the modifed date with the files date
				// ^^ NEEDS rewriting: Go into the main_log folder (of that said folder, and grab the most recent row filled in

				all_sheet_logs.push({
					file_name: log_row._rawData[0],
					// fileID: return_values[0],
					// status: return_values[1],
					frequency_ofSubmission: frequency_ofSubmission[log_row._rawData[2]]
				});
			}
		}
	});
	return all_sheet_logs;
}

create_main_log_object(YOUR_ROOT_FOLDER).then((sheet_answer) => {
	//console.log(sheet_answer);
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

module.exports = { connection, create_main_log_object };