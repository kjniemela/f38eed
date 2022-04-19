const { Sequelize, Op } = require("sequelize");
const db = require("../db");

const Message_Reader = db.define('message_reader', {}, { timestamps: false });

module.exports = Message_Reader;