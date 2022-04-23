const { Sequelize, Op } = require("sequelize");
const db = require("../db");

const User_Conversation = db.define('user_conversations', {}, { timestamps: false });

module.exports = User_Conversation;
