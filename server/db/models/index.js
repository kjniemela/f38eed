const Conversation = require("./conversation");
const User = require("./user");
const Message = require("./message");
const Message_Reader = require("./message_reader");

// associations

User.hasMany(Conversation);
Conversation.belongsTo(User, { as: "user1" });
Conversation.belongsTo(User, { as: "user2" });
Message.belongsTo(Conversation);
Conversation.hasMany(Message);
Message.belongsToMany(User, { through: Message_Reader });
User.belongsToMany(Message, { through: Message_Reader });

module.exports = {
  User,
  Conversation,
  Message
};
