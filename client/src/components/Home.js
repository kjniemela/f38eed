import React, { useCallback, useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import { Grid, CssBaseline, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

import { SidebarContainer } from '../components/Sidebar';
import { ActiveChat } from '../components/ActiveChat';
import { SocketContext } from '../context/socket';

const useStyles = makeStyles((theme) => ({
  root: {
    height: '100vh',
  },
}));

const Home = ({ user, logout }) => {
  const history = useHistory();

  const socket = useContext(SocketContext);

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);

  const classes = useStyles();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const addSearchedUsers = (users) => {
    const currentUsers = {};

    // make table of current users so we can lookup faster
    conversations.forEach((convo) => {
      currentUsers[convo.otherUser.id] = true;
    });

    const newState = [...conversations];
    users.forEach((user) => {
      // only create a fake convo if we don't already have a convo with this user
      if (!currentUsers[user.id]) {
        let fakeConvo = { otherUser: user, messages: [] };
        newState.push(fakeConvo);
      }
    });

    setConversations(newState);
  };

  const clearSearchedUsers = () => {
    setConversations((prev) => prev.filter((convo) => convo.id));
  };

  const saveMessage = async (body) => {
    const { data } = await axios.post('/api/messages', body);
    return data;
  };

  const sendMessage = (data, body) => {
    socket.emit('new-message', {
      message: data.message,
      recipientId: body.recipientId,
      sender: data.sender,
    });
  };

  const postMessage = async (body) => {
    try {
      const data = await saveMessage(body);

      if (!body.conversationId) {
        addNewConvo(body.recipientId, data.message);
      } else {
        addMessageToConversation(data);
      }

      sendMessage(data, body);
    } catch (error) {
      console.error(error);
    }
  };

  const addNewConvo = useCallback(
    (recipientId, message) => {
      setConversations((prev) =>
        prev.map((convo) => {
          if (convo.otherUser.id === recipientId) {
            const updatedConvo = { ...convo };
            updatedConvo.messages.push(message);
            updatedConvo.latestMessageText = message.text;
            updatedConvo.id = message.conversationId;
            return updatedConvo;
          } else {
            return convo;
          }
        })
      );
    },
    [setConversations]
  );

  const addMessageToConversation = useCallback(
    (data) => {
      // if sender isn't null, that means the message needs to be put in a brand new convo
      const { message, sender = null } = data;
      if (sender !== null) {
        const newConvo = {
          id: message.conversationId,
          otherUser: sender,
          messages: [message],
          notificationCount: 1,
        };
        newConvo.latestMessageText = message.text;
        setConversations((prev) => [newConvo, ...prev]);
      } else {
        setConversations((prev) =>
          prev.map((convo) => {
            if (convo.id === message.conversationId) {
              const updatedConvo = { ...convo };
              updatedConvo.messages.push(message);
              updatedConvo.latestMessageText = message.text;
              if (updatedConvo.otherUser.username !== activeConversation && message.senderId === updatedConvo.otherUser.id) {
                updatedConvo.notificationCount++;
              }
              return updatedConvo;
            } else {
              return convo;
            }
          })
        );
      }
    },
    [setConversations, activeConversation]
  );

  const setActiveChat = (username) => {

    setConversations((prev) =>
      prev.map((convo) => {
        if (convo.otherUser.username === username && convo.notificationCount > 0) {
          const updatedConvo = { ...convo };
          updatedConvo.notificationCount = 0;

          let latestReceivedMessage;
          let i = updatedConvo.messages.length - 1;
          do {
            latestReceivedMessage = updatedConvo.messages[i];
            i--;
          } while (latestReceivedMessage.senderId !== updatedConvo.otherUser.id && i >= 0);

          axios.put('/api/messages/read', latestReceivedMessage);
          socket.emit('message-read', {
            conversationId: updatedConvo.id,
            messageId: latestReceivedMessage.id,
            readerId: user.id,
            senderId: updatedConvo.otherUser.id,
          });

          return updatedConvo;
        } else {
          return convo;
        }
      })
    );

    setActiveConversation(username);
  };

  const addOnlineUser = useCallback((id) => {
    setConversations((prev) =>
      prev.map((convo) => {
        if (convo.otherUser.id === id) {
          const convoCopy = { ...convo };
          convoCopy.otherUser = { ...convoCopy.otherUser, online: true };
          return convoCopy;
        } else {
          return convo;
        }
      })
    );
  }, []);

  const removeOfflineUser = useCallback((id) => {
    setConversations((prev) =>
      prev.map((convo) => {
        if (convo.otherUser.id === id) {
          const convoCopy = { ...convo };
          convoCopy.otherUser = { ...convoCopy.otherUser, online: false };
          return convoCopy;
        } else {
          return convo;
        }
      })
    );
  }, []);

  const updateMessageReadStatus = useCallback((data) => {

    setConversations((prev) =>
      prev.map((convo) => {
        if (convo.id === data.conversationId && convo.otherUser.id === data.readerId) {
          const updatedConvo = { ...convo };

          updatedConvo.lastReadByOther = data.messageId;

          return updatedConvo;
        } else {
          return convo;
        }
      })
    );

  }, []);

  // Lifecycle

  useEffect(() => {
    // Socket init
    socket.on('add-online-user', addOnlineUser);
    socket.on('remove-offline-user', removeOfflineUser);
    socket.on('new-message', addMessageToConversation);
    socket.on('message-read', updateMessageReadStatus);

    return () => {
      // before the component is destroyed
      // unbind all event handlers used in this component
      socket.off('add-online-user', addOnlineUser);
      socket.off('remove-offline-user', removeOfflineUser);
      socket.off('new-message', addMessageToConversation);
      socket.off('message-read', updateMessageReadStatus);
    };
  }, [addMessageToConversation, addOnlineUser, removeOfflineUser, updateMessageReadStatus, socket]);

  useEffect(() => {
    // when fetching, prevent redirect
    if (user?.isFetching) return;

    if (user && user.id) {
      setIsLoggedIn(true);
    } else {
      // If we were previously logged in, redirect to login instead of register
      if (isLoggedIn) history.push('/login');
      else history.push('/register');
    }
  }, [user, history, isLoggedIn]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await axios.get('/api/conversations');
        for (const convo of data) {
          convo.messages.reverse();
        }
        setConversations(data);
      } catch (error) {
        console.error(error);
      }
    };
    if (!user.isFetching) {
      fetchConversations();
    }
  }, [user]);

  const handleLogout = async () => {
    if (user && user.id) {
      await logout(user.id);
    }
  };

  return (
    <>
      <Button onClick={handleLogout}>Logout</Button>
      <Grid container component="main" className={classes.root}>
        <CssBaseline />
        <SidebarContainer
          conversations={conversations}
          user={user}
          clearSearchedUsers={clearSearchedUsers}
          addSearchedUsers={addSearchedUsers}
          setActiveChat={setActiveChat}
        />
        <ActiveChat
          activeConversation={activeConversation}
          conversations={conversations}
          user={user}
          postMessage={postMessage}
        />
      </Grid>
    </>
  );
};

export default Home;
