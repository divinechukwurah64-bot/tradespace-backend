const Notification = require('../models/Notification');

// Creates an in-app notification. A failure here never breaks the action that triggered it.
const notify = async (userId, { type = 'info', title, message = '', link = null }) => {
  if (!userId) return;
  try {
    await Notification.create({
      userId,
      type,
      title,
      message: String(message).slice(0, 300),
      link
    });
  } catch (err) {
    console.error('notify error:', err.message);
  }
};

module.exports = notify;