
const express = require('express');

const router = express.Router();

const admin = require('./admin');
const farmer = require('./farmer');

router.use('/', admin);
router.use('/farm', farmer);

module.exports = router;