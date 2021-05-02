const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')

const {
	connection,
	isLoggedIn,
	frequency_ofSubmission
} = require("./utils");
const {
	create_main_log_object
} = require("./google.utils");

const saltRounds = 10;
const farmer = express.Router();
farmer.use(bodyParser.urlencoded({
	extended: true
}));

farmer.get("/view-status", isLoggedIn, (req, res) => {
	connection.query("SELECT id FROM farmers WHERE farm_name=?", "test", function(err, farmer) {
		if (err) console.error(err);
		// go into the status table and grab values from there
		connection.query("SELECT * FROM status WHERE farmer_id=?", farmer[0].id, (err, stati) => {
			if (err) console.error(err);
			let type = []
			stati.forEach((stat) => {
				type[frequency_ofSubmission[stat.frequency]] = !type[frequency_ofSubmission[stat.frequency]] ? {
					row: []
				} : type[frequency_ofSubmission[stat.frequency]];
				type[frequency_ofSubmission[stat.frequency]].row.push({ ...{
						FILE_NAME: stat.file_name,
						FILE_ID: "docs.google.com/" + stat.file_type + "s/d/" + stat.file_id + "/edit",
						STATUS: stat.status
					}
				});
			});
			type.forEach((item) => {
				console.log(item);
			});
			console.log(type);
			res.render("index", {
				type
			});
		});
	});

});

farmer.get("/update", async (req, res) => {
	connection.query("SELECT * FROM farmers", async function(err, farmer) {
		if (err) console.log(err);
		let await_farmers = farmer.map(function(item, index) {
			return new Promise(async function(resolve, reject) {

				try {
					let status = await create_main_log_object('1gTpKQ1eFgI5iU5TT0_3A4NJUs4D2zD9w');
					let stat = status.map(function(folder) {
						return new Promise(function(end, stop) {
							connection.query("DELETE FROM status WHERE farmer_id=?", item.id, (err) => {
								if (err) console.error(err);
								folder.file_type = !folder.file_type ? "unknown" : folder.file_type;
								connection.query("INSERT INTO status (farmer_id, file_name, file_id, status, file_type, frequency) VALUES (?, ?, ?, ?, ?, ?)", [item.id, folder.file_name, folder.file_id, folder.status.toString(), folder.file_type, folder.frequency_ofSubmission], function(err) {
									if (err) console.log(err);
									end();
								});
							});
						});
					});
					await Promise.all(stat);
					resolve();
				} catch (error) {
					console.error(error);
					resolve();
				}
			});
		});
		await Promise.all(await_farmers);
		res.end();
	});
});

module.exports = farmer;