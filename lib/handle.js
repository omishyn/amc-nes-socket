function handleMessage(socket, message) {
  const messageObj = JSON.parse(message);

  if(typeof messageObj === 'object') {
    switch(messageObj.type) {
      case 'logout':
      case 'silentLogout':
        broadcast(JSON.stringify({
          docs: {
            ...messageObj,
            fromSocketId: socket.id
          }
        }));
        break;
    }
  }
}

module.exports = {
  handleMessage
};
