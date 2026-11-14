const express = require('express');
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Allow both / and /my
router.get('/', getMyNotifications);
router.get('/my', getMyNotifications);

// Allow both PUT and PATCH for marking read
router.patch('/:id/read', markAsRead);
router.put('/:id/read', markAsRead);

router.patch('/read-all', markAllAsRead);
router.put('/read-all', markAllAsRead);

module.exports = router;
