/*!
 * Samsaara Groups Module
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

// Rules
// Context IDs must be unique, globally, including subcontext
//


var debug = require('debug')('samsaara:contexts');
var debugError = require('debug')('samsaara:contexts:error');


var core,
    samsaara,
    connectionController,
    communication,
    ipc;

var interProcess;

var connections;

var contexts = {};
var Context;


// the root interface loaded by require. Options are pass in options here.

function main(opts){
  return initialize;
}


// samsaara will call this method when it's ready to load it into its middleware stack
// return your main

function initialize(samsaaraCore){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;
  connectionController = samsaaraCore.connectionController;
  communication = samsaaraCore.communication;
  ipc = samsaaraCore.ipc;
  connections = connectionController.connections;

  interProcess = samsaaraCore.capability.ipc;

  samsaaraCore.addClientFileRoute("samsaara-contexts.js", __dirname + '/client/samsaara-contexts.js');

  var contextController = {
    name: "contexts",
    clientScript: __dirname + '/client/samsaara-contexts.js',
    main: {
      context: context,
      contextExists: contextExists,
      createContext: createContext,
      addToContext: addToContext,
      removeFromContext: removeFromContext,
      contexts: contexts
    },
    remoteMethods: {},
    messageRoutes: {
      CTX: route
    },
    connectionInitialization: {
      contexts: connectionInitialzation
    },
    connectionClose: {
      contexts: connectionClosing
    },
    constructors: {},
    testable: {}
  };


  if(interProcess === true){

    contextController.main.context = contextIPC;
    contextController.main.createContext = createContextIPC;
    contextController.main.contextExists = contextExistsIPC;
    // contextController.main.removeContext = removeContextIPC;
    contextController.main.addToContext = addToContextIPC;
    contextController.main.removeFromContext = removeFromContextIPC;

    contextController.messageRoutes.CTX = routeIPC;

    contextController.remoteMethods.joinContext = joinContextIPC;
    contextController.remoteMethods.leaveContext = leaveContextIPC;

    samsaara.nameSpace("interprocess").expose({
      // removeContext: removeContextIPC,
      addToContext: addToContextIPC,
      removeFromContext: removeFromContextIPC
    });

    // ipc.use({
    //   symbolicConnectionInitialization: symbolicConnectionInitialization,
    //   symbolicConnectionClosing: symbolicConnectionClosing
    // });

    samsaara.createNamespace("contextController", {
      joinContext: joinContextIPC,
      leaveContext: leaveContextIPC
    });

  }
  else{
    samsaara.createNamespace("contextController", {
      joinContext: joinContext,
      leaveContext: leaveContext
    });
  }

  Context = require('./context').initialize(samsaaraCore, contexts, contextController.main);

  contextController.constructors.Context = Context;

  return contextController;
}





// context generator

function context(contextID){
  return contexts[contextID];
}


function contextIPC(contextID){
  if(contexts[contextID] !== undefined){
    return contexts[contextID];
  }
  else{
    return {

      local: false,

      add: function(connection, callBack){
        ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
          ipc.process(ownerID).execute("addToContext", contextID, connection.id, callBack);
        });
      },
      remove: function(connection, callBack){
        ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
          ipc.process(ownerID).execute("removeFromContext", contextID, connection.id, callBack);
        });
      }
    };
  }
}





function contextExists(contextID, callBack){

  if(contexts[contextID] === undefined){
    if(typeof callBack === "function") callBack(false, null);
  }
  else{
    if(typeof callBack === "function") callBack(true, "local");
  }
}


function contextExistsIPC(contextID, callBack){
  if(contexts[contextID] === undefined){
    ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
      if(ownerID !== null){
        if(typeof callBack === "function") callBack(true, "remote", ownerID);
      }
      else{
        if(typeof callBack === "function") callBack(false, null);
      }
    });
  }
  else{
    if(typeof callBack === "function") callBack(true, "local");
  }
}





function createContext(contextID, options, callBack){
  if(typeof options === "function"){
    callBack = options;
    options = undefined;
  }

  contextExists(contextID, function(exists){
    if(exists === false){
      contexts[contextID] = new Context(contextID, options);
      samsaara.emit("newContext", contexts[contextID]);
      if(typeof callBack === "function") callBack(null, contexts[contextID]);
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context "+contextID+" exists"), null);
    }
  });
}

function createContextIPC(contextID, options, callBack){

  debug("Creating Context");

  if(typeof options === "function"){
    callBack = options;
    options = undefined;
  }

  contextExistsIPC(contextID, function(exists){
    if(exists === false){
      contexts[contextID] = new Context(contextID, options);
      samsaara.emit("newContext", contexts[contextID]);
      if(typeof callBack === "function") callBack(null, contexts[contextID]);
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context "+contextID+" exists"), null);
    }
  });
}



function addToContext(contextID, connID, callBack){

  debug("Adding Connection to Context", contextID, connID);

  contextExists(contextID, function (exists, where, ownerID){

    if(exists === true){
      if(connections[connID] !== undefined){
        addConnectionToContext(contexts[contextID], connID);
      }
      else{
        if(typeof callBack === "function") callBack(new Error("Connection Does Not Exist"), contextID, connID);
      }
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context Does Not Exist"), contextID, connID);
    }
  });
}

// Add connection to context

function addToContextIPC(contextID, connID, callBack){

  debug("Adding Connection to Context IPC", contextID, connID);

  contextExists(contextID, function (exists, where, ownerID){

    if(exists === true){
      if(where === "local"){
        if(connections[connID] !== undefined){
          addConnectionToContext(contexts[contextID], connID);
        }
        else{
          ipc.generateSymbolic(connID, function (err, symbolicConnection){

            if(err !== null){
              debugError("Generate Symbolic for Context Error:", err, contextID, connID);
              if(typeof callBack === "function") callBack(err, contextID, connID);
            }
            else{
              addConnectionToContext(contexts[contextID], connID);
              if(typeof callBack === "function") callBack(null, contextID, connID);
            }
          });
        }
      }
      if(where === "remote"){
        samsaara.process(ownerID).execute("addToContext", contextID, connID, callBack);
      }
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context does not exist"), contextID, connID);
    }
  });
}



function addConnectionToContext(context, connID){
  if(!context.members[connID]){

    if(connections[connID]){
      if(connections[connID].owner !== core.uuid){
        ipc.publish("PRCCTX:"+symbolicConnection.owner+":ADD", "CTX:"+contextID+":NTV:"+connID+":OWNER:"+core.uuid);
      }
      else{
        connections[connID].contexts[context.id] = core.uuid;
      }
    }
    context.count++;
    context.members[connID] = true;
    return true;
  }
  else{
    return false;
  }
}


function handleConnectionAddedToContext(channel, message){
  var split = message.split(":");

  var contextID = split[1];
  var connID = split[3];
  var owner = split[5];

  connections[connID].contexts[contextID] = owner;
}



// remove connection from context

function removeFromContext(contextID, connID, callBack){
  if(contexts[contextID] !== undefined){
    removeConnectionFromContext(contexts[contextID], connID);
    if(typeof callBack === "function") callBack(null, contextID, connID);
  }
  else{
    if(typeof callBack === "function") callBack("Context does not exist", contextID, connID);
  }
}


function removeFromContextIPC(contextID, connID, callBack){
  if(contexts[contextID] !== undefined){
    removeConnectionFromContext(contexts[contextID], connID);
    if(typeof callBack === "function") callBack(null, true);
  }
  else{
    ipc.process(contexts[contextID].owner).execute("removeFromContext", contextID, connID, callBack);
  }
}

function removeConnectionFromContext(context, connID){
  if(context.members[connID]){

    if(connections[connID]){
      if(connections[connID].owner !== core.uuid){
        ipc.publish("PRCCTX:"+symbolicConnection.owner+":DEL", "CTX:"+contextID+":NTV:"+connID+":OWNER:"+core.uuid);
      }
      else{
        connections[connID].contexts[context.id] = undefined;
      }
    }

    context.count--;
    delete context.members[connID];
  }
}

function handleConnectionRemovedFromContext(channel, message){
  var split = message.split(":");

  var contextID = split[1];
  var connID = split[3];
  var owner = split[5];

  if(connections[connID] && connections[connID].contexts[contextID]){
    connections[connID].contexts[contextID] = undefined;
  }
}


// Routing Methods including IPC handling

function route(connection, headerbits, message){

  var contextID = headerbits[1];

  if(contexts[contextID] !== undefined){
    var messageObj = parseJSON(message);
    if(messageObj !== undefined){
      communication.executeFunction(connection, contexts[contextID].data, messageObj);
    }
  }
}


function routeIPC(connection, headerbits, message){

  var contextID = headerbits[1];

  if(contexts[contextID] === undefined){
    ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
      if(ownerID !== null){
        if(connection.symbolicOwners[ownerID] !== undefined){
          ipc.publish("PRC:"+ownerID+":CTXFWD", "CTX:"+contextID+":FRM:"+connection.id+"::"+message);
        }
        else{
          ipc.process(ownerID).createSymbolic(connection, function (err){
            if(!err){
              ipc.publish("PRC:"+ownerID+":CTXFWD", "CTX:"+contextID+":FRM:"+connection.id+"::"+message);
            }
            else{
              debugError("Error Routing Message", new Error("Error creating symbolic Connection"));
            }
          });
        }
      }
    });
  }
  else{
    var messageObj = parseJSON(message);

    if(messageObj !== undefined){
      messageObj.sender = connection.id;
      messageObj.ns = "CTX_"+contextID;
      debug("Executing Resource Message", JSON.stringify(messageObj), contextID, headerbits);
      communication.executeFunction(connection, contexts[contextID].data, messageObj);
    }
  }
}


// double parsing (header and body)... can we combine them somehow?

function handleContextMessage(channel, message){

  debug("Handling Context Message", core.uuid, channel, message);

  var index = message.indexOf("::");
  var senderInfoSplit = message.split(":");
  var connMessage = message.slice(2+index-message.length);

  var contextID = senderInfoSplit[1];
  var connID = senderInfoSplit[3];

  var connection = connections[connID] || {id: connID};
  var context = contexts[contextID];

  if(context !== undefined){

    var messageObj = JSON.parse(connMessage);

    if(messageObj.ns){
      messageObj.ns = contextID + "_" + messageObj.ns;
    }
    else{
      messageObj.ns = contextID + "_core";
    }

    debug("Process Context Message", senderInfoSplit, connID, JSON.stringify(messageObj));

    communication.executeFunction(connection, context, messageObj);
  }
}




// connection initialization

function connectionInitialzation(opts, connection, attributes){
  connection.contexts = {};
}


// connection closing

function connectionClosing(connection){
  var connID = connection.id;
  var connContexts = connection.contexts;

  for(var contextID in connContexts){

    if(contextID !== undefined){

      var context = contexts[connContexts[contextID]];
      if(context !== undefined){
        context.remove(connection);
      }
    }
  }
}

function connectionClosingIPC(connection){
  var connID = connection.id;
  var connContexts = connection.contexts;

  for(var contextID in connContexts){

    if(contextID !== undefined){
      if(connContexts[contextID] === core.uuid){
        var context = contexts[connContexts[contextID]];
        if(context !== undefined){
          context.remove(connection);
        }
      }
      else{
        ipc.publish("PRCCTX:"+connContexts[contextID]+":DELCONN", "CTX:"+contextID+ ":NTV:"+connID);
      }
    }
  }
}





function joinContext(connection, contextID, callBack){
  addToContext(contextID, connection.id, function (err, contextID, connID){
    if(typeof callBack === "function") callBack(err, contextID, core.uuid);
  });
}

function joinContextIPC(connection, contextID, callBack){
  addToContextIPC(contextID, connection.id, function (err, contextID, connID){
    console.log("Circular Structure?", err, contextID, connID);
    if(typeof callBack === "function") callBack(err, contextID, core.uuid);
  });
}

function leaveContext(connection, contextID, callBack){
  removeFromContext(contextID, connection.id, function (err, success){
    if(typeof callBack === "function") callBack(err, success);
  });
}

function leaveContextIPC(connection, contextID, callBack){
  removeFromContextIPC(contextID, connection.id, function (err, success){
    if(typeof callBack === "function") callBack(err, success);
  });
}




function parseJSON(jsonString){
  var parsed;

  try{
    parsed = JSON.parse(jsonString);
  }
  catch(e){
    debug("Message Error: Invalid JSON", jsonString, e);
  }

  return parsed;
}


module.exports = exports = main;
