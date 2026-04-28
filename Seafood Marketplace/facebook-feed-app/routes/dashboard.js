const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/overview', (req, res) => dashboardController.getOverview(req, res));

module.exports = router;
