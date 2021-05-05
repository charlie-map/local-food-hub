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

const {
	edit_dist,
	connection,
	frequency_ofSubmission
} = require("./utils.js");
const {
	seasons,
	season
} = require("./season.js");

// Pull date libraries:
const Sugar = require('sugar');
const spacetime = require('spacetime');
const moment = require('moment');

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
	let file_id, return_file_name, return_dist, parent_id, type;
	all_files.files.forEach((file) => {
		curr_distance = edit_dist(file.name.trim(), file_name);
		first_letter_dist = edit_dist(file.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 5), file_name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 5));

		if (curr_distance < lowest_fuzzy && first_letter_dist < 3 && file.mimeType.split(".")[file.mimeType.split(".").length - 1] == "form") {
			lowest_fuzzy = curr_distance;
			file_id = file.id;
			return_file_name = file.name.trim();
			parent_id = file.parents[file.parents.length - 1];
			type = file.mimeType.split(".")[file.mimeType.split(".").length - 1];
		}
	});

	if (!file_id || lowest_fuzzy > 10) { // redo process, but look for a sheet instead
		all_files.files.forEach((file) => {
			curr_distance = edit_dist(file.name.trim(), file_name);
			first_letter_dist = edit_dist(file.name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 5), file_name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 5));

			if (curr_distance < lowest_fuzzy && first_letter_dist < 3 && file.mimeType.split(".")[file.mimeType.split(".").length - 1] == "spreadsheet") {
				lowest_fuzzy = curr_distance;
				file_id = file.id;
				return_file_name = file.name.trim();
				parent_id = file.parents[file.parents.length - 1];
				type = file.mimeType.split(".")[file.mimeType.split(".").length - 1];
			}
		});
	}

	return [file_id, type, return_file_name, parent_id];
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

	console.log(folder_id);
	let gdrive = await googleDriveInstance.useServiceAccountAuth(creds_service_user);

	let root_files = await pull_files(googleDriveInstance, folder_id, false, false);
	let mainlog_sheet_id = "";
	root_files.files.forEach((item) => {
		if (edit_dist(item.name.substring(item.name.length - 12).toLowerCase().replace(/[^a-z]/g, ""), "logschedule") < 3)
			mainlog_sheet_id = item.id;
	});

	root_files = await pull_files(googleDriveInstance, folder_id, true, true);
	let main_logs = await pull_main_logs(googleDriveInstance, folder_id);
	// go through main logs and create a connnection to each spreadsheet
	let pull_logs = main_logs.map(async (log, index) => {
		return new Promise(async (resolve, reject) => {
			let pull_log_doc = new GoogleSpreadsheet(log.id);
			await pull_log_doc.useServiceAccountAuth({
				client_email: process.env.CLIENT_EMAIL,
				private_key: process.env.PRIVATE_KEY
			})
			await pull_log_doc.loadInfo();
			main_logs[index] = {
				name: log.name,
				parent_id: log.parents[log.parents.length - 1],
				doc: pull_log_doc
			}
			resolve();
		});
	});
	await Promise.all(pull_logs);

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
	all_dates.daily = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), daily_value[0]);
	all_dates.daily = Sugar.Date.isFuture(all_dates.daily) ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 7, daily_value[0]) : all_dates.daily;

	let weekly_value = new Date(moment().day(full_row_data[frequency_position + 2]._rawData[full_row_data[frequency_position + 2]._rawData.length - 1]));
	weekly_value = new Date(new Date(weekly_value).getFullYear(), new Date(weekly_value).getMonth(), new Date(weekly_value).getDate(), daily_value[0]);
	weekly_value = Sugar.Date.isFuture(weekly_value) ? new Date(new Date(weekly_value).getFullYear(), new Date(weekly_value).getMonth(), new Date(weekly_value).getDate() - 7, daily_value[0]) : new Date(new Date(weekly_value).getFullYear(), new Date(weekly_value).getMonth(), new Date(weekly_value).getDate(), daily_value[0]);
	all_dates.weekly = weekly_value;

	// get first week of this month
	let monthly_value = new Date(moment().day(full_row_data[frequency_position + 3]._rawData[full_row_data[frequency_position + 3]._rawData.length - 1]));
	monthly_value = new Date(monthly_value.getFullYear(), monthly_value.getMonth(), Math.round((monthly_value.getDate() + 1) % 7), daily_value[0]);

	all_dates.monthly = monthly_value;

	let season_date = new Date();
	all_dates.seasonal = season(season_date, seasons);
	// // find what date season lines up
	let temp_season = all_dates.seasonal;
	while (all_dates.seasonal == temp_season) {
		// create a new date moved back\
		season_date = new Date(season_date.getFullYear(), season_date.getMonth(), season_date.getDate() - 1);
		all_dates.seasonal = season(season_date, seasons);
	}
	all_dates.seasonal = new Date(season_date.getFullYear(), season_date.getMonth(), season_date.getDate() + 1);

	for (let days = 1; days < 8; days++) { // find first monday of year
		all_dates.annual = new Date(new Date().getFullYear(), 0, days, daily_value[0]);
		if (all_dates.annual.getDay() == 1)
			break;
	}
	if (Sugar.Date.isFuture(all_dates.annual)) all_dates.annual = new Date(new Date(all_dates.annual).getFullYear() - 1, 0, new Date(all_dates.annual).getDay(), daily_value[0]);

	let preharvest_date = Sugar.Date.create(full_row_data[frequency_position + 6]._rawData[full_row_data[frequency_position + 6]._rawData.length - 1]);
	while (Sugar.Date.isFuture(preharvest_date)) {
		preharvest_date = new Date(preharvest_date.getFullYear() - 1, preharvest_date.getMonth(), preharvest_date.getDate(), daily_value[0]);
	}
	all_dates.preharvest = preharvest_date;
	all_dates.deliverydays = Sugar.Date.create("last" + full_row_data[frequency_position + 7]._rawData[full_row_data[frequency_position + 7]._rawData.length - 1].replace(/[ ]/g, "").split("and")[0]);

	// 1. daily = 0 ---- every day at 6am (weekends?)
	// 2. weekly = 1 ---- mondays at 6am
	// 3. monthly = 2 ---- first monday of month at 6am
	// 4. seasonal = 3 ---- start of new season (first monday of 6am)
	// 5. annual = 4 ---- first monday of new year at 6am
	// 6. preharvest = 5 ---- august 10th
	// 7. deliverydays = 6 ---- friday and monday at 6am
	let all_sheet_logs = [];
	let count = 0;
	let row_awaiting = full_row_data.map((log_row, index) => {
		return new Promise(async (resolve, reject) => {
			// if (index < 7) {
			// run through all the log data
			// find the ones that have at least 3 items (meaning they have enough data to qualify)
			if (log_row._rawData[0] && log_row._rawData[0].length && log_row._rawData[2] && log_row._rawData[2].length) {
				log_row._rawData[2] = log_row._rawData[2].toLowerCase().replace(/[^a-z]/g, "");
				// find what log_row._rawData[2] (the frequency of submission) is closest to (fuzzy wuzzy it)
				let status = false; // if they still need to turn it in
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
				let return_file = find_id(root_files, log_row._rawData[0], log_row._rawData[2]);
				let use_spreadsheet; // save the index of the spreadsheet we're using for this specific file

				main_logs.forEach((log, log_index) => { // find the main log connected to this file
					if (log.parent_id == return_file[3]) {
						use_spreadsheet = log_index;
					}
				});
				// go into this spreadsheet and look at each tab, find the one most closely resembling the tag-ids
				if (main_logs[use_spreadsheet] && return_file[0]) {
					await new Promise((connection_promise) => {
						connection.query("SELECT farmer_id, frequency FROM status WHERE file_id=? AND ignore_notifier=1", return_file[0], async (err, ignore_count) => {
							if (err) console.error(err);
							if (ignore_count.length) { // still check if today's date matches up
								if (!Sugar.Date(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), daily_value[0], 0, 0)).is(all_dates[ignore_count[0].frequency])) {
									status = false;
									return connection_promise();
								} else {
									status = true;
								}
							}
							if (status) await new Promise((resolve) => {
								console.log("here");
								connection.query("UPDATE status SET ignore_notifier=1 WHERE file_id=?", return_file[0], err => {
									if (err) console.error(err);
									console.log("update");
									resolve();
								});
							});
							// find the correct index within the document - if we get to the end and still no position, it's a spreadsheet (same functional check, slightly different)
							let spreadsheet_index_index = -1;
							if (return_file[1] == "form")
								for (let run = 0; run < main_logs[use_spreadsheet].doc.sheetsByIndex.length; run++) {
									main_logs
									if (edit_dist(log_row._rawData[0].toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 4), main_logs[use_spreadsheet].doc.sheetsByIndex[run]._rawProperties.title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 4)) < 2) {
										spreadsheet_index_index = run;
										break;
									}
								};

							// don't need to check if it's one of the following:
							/* onincident: 5,
								asneeded: 6,
								correctiveaction: 7,
								riskassesment: 8 */
							let frequency_numCheck = frequency_ofSubmission[log_row._rawData[2]];
							if (frequency_numCheck == 5 || frequency_numCheck == 6 || frequency_numCheck == 7 || frequency_numCheck == 8) {
								status = false;
							} else {
								if (spreadsheet_index_index != -1) { // we can safely traverse the file and look for our date
									status = await check_status(main_logs, all_dates, log_row._rawData[2], use_spreadsheet, spreadsheet_index_index, index);
								} else {
									status = true;
								}
							}
						});
					});
				} else {
					status = false;
				}

				all_sheet_logs[index] = {
					file_name: log_row._rawData[0],
					file_id: return_file[0],
					status: status,
					file_type: return_file[1],
					frequency_ofSubmission: log_row._rawData[2]
				};
			}
			resolve();
		});
	});
	await Promise.all(row_awaiting);
	console.log("finished", all_sheet_logs);
	return all_sheet_logs;
}

function check_status(google_sheet, all_dates, indicated_date, specific_spreadsheet, specific_index, index) {
	return new Promise(async (resolve, reject) => {
		let spreadsheet_rows;
		if ((specific_spreadsheet || specific_spreadsheet == 0) && (specific_index || specific_index == 0)) {
			try {
				spreadsheet_rows = await google_sheet[specific_spreadsheet].doc.sheetsByIndex[specific_index].getRows();
				// grab most recent value (specifically the timestamp) in the table
				if (!spreadsheet_rows[spreadsheet_rows.length - 1]) {
					return resolve(true); // check to make sure there are values
				}
				let timestamp = spreadsheet_rows[spreadsheet_rows.length - 1] && spreadsheet_rows[spreadsheet_rows.length - 1]._rawData ? new Date(spreadsheet_rows[spreadsheet_rows.length - 1]._rawData[0]) : undefined;
				if (all_dates[indicated_date] && timestamp && Sugar.Date(all_dates[indicated_date]).isAfter(timestamp)) {
					return resolve(true);
				}
			} catch (error) {
				console.error(error);
				return resolve(false);
			}
		}
		return resolve(false);
	});
}

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

module.exports = {
	create_main_log_object
};