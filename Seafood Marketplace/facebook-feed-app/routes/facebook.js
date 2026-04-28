const express = require('express');
const feedController = require('../controllers/feedController');

const router = express.Router();

router.get('/health', feedController.health);
router.post('/sync', feedController.syncProducts);

module.exports = router;
