const Conversation = require("./conversation");
const User = require("./user");
const Message = require("./message");
const Message_Reader = require("./message_reader");
const User_Conversation = require("./user_conversation");

// associations

User.hasMany(Conversation);
Conversation.belongsToMany(User, { through: User_Conversation });
Message.belongsTo(Conversation);
Conversation.hasMany(Message);
Message.belongsToMany(User, { through: Message_Reader });
User.belongsToMany(Message, { through: Message_Reader });

module.exports = {
  User,
  Conversation,
  Message
};
