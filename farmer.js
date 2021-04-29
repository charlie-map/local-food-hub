const express = require('express');
const bcrypt = require('bcrypt');

const { connection } = require("./utils");
const { create_main_log_object } = require("./server");

const saltRounds = 10;
const farmer = express.Router()

farmer.get("/view-status", (req, res) => {
 connection.query("SELECT root_folder FROM farmers", function(err, farmer){
		if (err) console.log(err);
		console.log(farmer);
	});

});

module.exports = farmer;