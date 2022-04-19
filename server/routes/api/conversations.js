const router = require("express").Router();
const { User, Conversation, Message } = require("../../db/models");
const { Op } = require("sequelize");
const onlineUsers = require("../../onlineUsers");

// get all conversations for a user, include latest message text for preview, and all messages
// include other user model so we have info on username/profile pic (don't include current user info)
router.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      return res.sendStatus(401);
    }
    const userId = req.user.id;
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: {
          user1Id: userId,
          user2Id: userId,
        },
      },
      attributes: ["id"],
      order: [[Message, "createdAt", "DESC"]],
      include: [
        {
          model: Message,
          order: ["createdAt", "DESC"],
          include: [
            { model: User, attributes: ["id"] }
          ]
        },
        {
          model: User,
          as: "user1",
          where: {
            id: {
              [Op.not]: userId,
            },
          },
          attributes: ["id", "username", "photoUrl"],
          required: false,
        },
        {
          model: User,
          as: "user2",
          where: {
            id: {
              [Op.not]: userId,
            },
          },
          attributes: ["id", "username", "photoUrl"],
          required: false,
        },
      ],
    });

    for (let i = 0; i < conversations.length; i++) {
      const convo = conversations[i];
      const convoJSON = convo.toJSON();

      // set a property "otherUser" so that frontend will have easier access
      if (convoJSON.user1) {
        convoJSON.otherUser = convoJSON.user1;
        delete convoJSON.user1;
      } else if (convoJSON.user2) {
        convoJSON.otherUser = convoJSON.user2;
        delete convoJSON.user2;
      }

      // set property for online status of the other user
      if (onlineUsers.includes(convoJSON.otherUser.id)) {
        convoJSON.otherUser.online = true;
      } else {
        convoJSON.otherUser.online = false;
      }

      // set properties for notification count and latest message preview
      // set properties "lastReadByMe" and "lastReadByOther" so that frontend will have easier access
      convoJSON.latestMessageText = convoJSON.messages[0].text;
      convoJSON.notificationCount = 0;
      let lastReadByMeFound = false;
      let lastReadByOtherFound = false;
      for (let i = 0; i < convoJSON.messages.length; i++) {
        const readerIds = convoJSON.messages[i].users.map(user => user.id);
        if (!lastReadByMeFound && readerIds.includes(userId)) {
          convoJSON.lastReadByMe = convoJSON.messages[i].id;
          lastReadByMeFound = true;
        }
        if (!lastReadByOtherFound && readerIds.includes(convoJSON.otherUser.id)) {
          convoJSON.lastReadByOther = convoJSON.messages[i].id;
          lastReadByOtherFound = true;
        }
        if (!lastReadByMeFound && convoJSON.messages[i].senderId !== userId) {
          convoJSON.notificationCount++;
        }
        if (lastReadByMeFound && lastReadByOtherFound) {
          break;
        }
      }

      conversations[i] = convoJSON;
    }

    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
