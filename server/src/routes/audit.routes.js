const express = require('express');
const { getAuditLogs } = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), getAuditLogs);

module.exports = router;
