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


function contextController(options){

  var core,
      samsaara,
      connectionController,
      communication,
      ipc;

  var interProcess;

  var connections;

  var contexts = {};
  var Context;


  //
  // main
  //

  // is the context with this ID open, locally or remotely?

  function isContextOpen(contextID, callBack){
    if(contexts[contextID] !== undefined){
      if(typeof callBack === "function") callBack(true, "local");
    }
    else{
      if(typeof callBack === "function") callBack(false, null);
    }
  }

  function isContextOpenIPC(contextID, callBack){

    if(contexts[contextID] === undefined){

      ipc.store.pubsub("NUMSUB", "CTX:"+contextID, function (err, reply){
        if(~~reply[1] === 0){
          if(typeof callBack === "function") callBack(false, null);
        }
        else{
          if(typeof callBack === "function") callBack(true, "remote");
        }
      });
    }
    else{
      if(typeof callBack === "function") callBack(true, "local");
    }
  }


  // Context creation and removal

  // Context IDs must be unique, globally, including subcontext
  // what happens if in IPC two people create a context with the same ID at the exact same time?

  function createContext(contextID, resource, parentContext, callBack){

    if(typeof parentContext === "function"){
      callBack = parentContext;
      parentContext = undefined;
    }

    debug("Creating Context", core.uuid, contextID, resource, parentContext);

    // is context already open?

    if(contexts[contextID] === undefined){

      contexts[contextID] = new Context(contextID, resource, parentContext);
      samsaara.emit("createdContext", contexts[contextID]);

      if(typeof callBack === "function") callBack(null, contexts[contextID]);
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context already exists"), undefined);
    }
  }


  function createContextIPC(contextID, resource, parentContext, callBack){

    if(typeof parentContext === "function"){
      callBack = parentContext;
      parentContext = undefined;
    }

    // is context already open?

    debug("Creating Context IPC", core.uuid, contextID, resource, parentContext);

    if(contexts[contextID] === undefined){

      ipc.store.pubsub("NUMSUB", "CTX:"+contextID, function (err, reply){

        if(~~reply[1] === 0){

          contexts[contextID] = new Context(contextID, resource, parentContext);

          ipc.addRoute("CTX:"+contextID, "CTX:"+contextID, handleContextMessage);

          ipc.store.hset("samsaara:contextOwners", contextID, core.uuid, function (err, reply){
            samsaara.emit("createdContext", contexts[contextID]);
            if(typeof callBack === "function") callBack(null, contexts[contextID], "local");
          });

        }
        else{
          if(typeof callBack === "function") callBack(new Error("Context already exists"), undefined, "remote");
        }
      });
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context already exists"), undefined, "local");
    }
  }


  function removeContext(contextID, callBack){
    delete contexts[contextID];
    if(typeof callBack === "function") callBack(err, true);
  }

  function removeContextIPC(contextID, callBack){
    if(contexts[contextID] !== undefined){

      ipc.removeRoute("CTX:"+contextID);

      ipc.store.hdel("samsaara:contextOwners", contextID, function (err, ownerID){
        samsaara.emit("removedContext", contexts[contextID]);
        delete contexts[contextID];
        if(typeof callBack === "function") callBack(err, true);
      });

    }
    else{

      ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){

        if(ownerID !== null){
          ipc.process(ownerID).execute("removeContext", contextID, function (err, success){
            if(err){
              if(typeof callBack === "function") callBack(err, false);
            }
            else{
              if(typeof callBack === "function") callBack(err, true);
            }
          });
        }
        else{
          if(typeof callBack === "function") callBack(err, false);
        }
      });
    }
  }

  function handleDeleteContext(channel, contextID){
    delete contexts[contextID];
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



  // Add connection to context

  function addToContext(contextID, connID, callBack){

    if(contexts[contextID] !== undefined){
      // context exists
      var context = contexts[contextID];

      if(connections[connID] !== undefined){
        // connection (real) is here

        addConnectionToContext(contexts[contextID], connID);
        if(typeof callBack === "function") callBack(null, contextID, connID);
      }
      else{
        // connection is not here, not much we can do.
        if(typeof callBack === "function") callBack(new Error("Connection does not exist"), contextID, connID);
      }
    }
    else{
      // context doesn't exist.
      if(typeof callBack === "function") callBack(new Error("Context does not exist"), contextID, connID);
    }
  }



  function addToContextIPC(contextID, connID, callBack){

    if(contexts[contextID] !== undefined){
      // context exists
      var context = contexts[contextID];

      if(connections[connID] !== undefined){
        // connection (real or symbolic) is here
        addConnectionToContext(contexts[contextID], connID);
        if(typeof callBack === "function") callBack(null, contextID, connID);
      }
      else{
        // connection is not here, so we need to create a symbolic connection
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
    else{
      if(typeof callBack === "function") callBack(new Error("Context does not exist"), contextID, connID);
    }
  }


  function addConnectionToContext(context, connID){
    if(!context.members[connID]){
      context.count++;
      context.members[connID] = true;
      return true;
    }
    else{
      return false;
    }
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
      context.count--;
      delete context.members[connID];
    }
  }



  // Routing Methods including IPC handling

  function route(connection, headerbits, message){

    var contextID = headerbits[1];

    if(contextID !== undefined && contexts[contextID] !== undefined){
      communication.executeFunction({connection: connection, context: contexts[contextID]}, messageObj);
    }
  }



  function routeIPC(connection, headerbits, message){

    var contextID = headerbits[1];

    if(contexts[contextID] === undefined){
      ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
        if(ownerID !== null){
          ipc.publish("PRC:"+ownerID+":CTXFWD", "CTX:"+contextID+":FRM:"+connection.id+"::"+message);
        }
      });
    }
    else{
      var messageObj = parseJSON(message);
      if(messageObj !== undefined){

        messageObj.sender = connection.id;

        if(messageObj.ns){
          messageObj.ns = contextID + "_" + messageObj.ns;
        }
        else{
          messageObj.ns = contextID + "_core";
        }

        debug("EXECUTING CONTEXT METHOD", message, contextID, headerbits);
        communication.executeFunction({connection: connection, context: contexts[contextID]}, messageObj); 
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

      communication.executeFunction({connection: connection, context: context}, messageObj);
    }
  }




  // connection initialization

  function connectionInitialzation(opts, connection, attributes){

    connection.contexts = {};

    if(opts.contexts !== undefined){
      debug("Initializing Contexts.....!!!", opts.contexts, connection.id);
      attributes.force("contexts");
      attributes.initialized(null, "contexts");
    }
  }


  // connection closing

  function connectionClosing(connection){
    var connID = connection.id;
    var connContexts = connection.contexts;

    for(var contextID in connContexts){
      var context = contexts[connContexts[contextID]];
      if(context !== undefined){
        removeConnectionFromContext(context, connID);
      }
    }
  }






  // symbolic connection initialization

  function symbolicConnectionInitialization(symbolicConnection){
    symbolicConnection.contexts = {};
  }


  // symbolic connection closing

  function symbolicConnectionClosing(symbolicConnection){
    var connID = symbolicConnection.id;
    var connContexts = symbolicConnection.contexts;

    for(var contextID in connContexts){
      var context = contexts[connContexts[contextID]];
      if(context !== undefined){
        removeConnectionFromContext(context, connID);
      }
    }
  }






  function joinContext(contextID, callBack){
    addToContext(contextID, this.connection.id, function (err, contextID, connID){
      if(typeof callBack === "function") callBack(err, contextID, core.uuid);
    });
  }

  function joinContextIPC(contextID, callBack){
    addToContextIPC(contextID, this.connection.id, function (err, contextID, connID){
      console.log("Circular Structure?",err, contextID, connID);
      if(typeof callBack === "function") callBack(err, contextID, core.uuid);
    });
  }

  function leaveContext(contextID, callBack){
    removeFromContext(contextID, this.connection.id, function (err, success){
      if(typeof callBack === "function") callBack(err, success);
    });
  }

  function leaveContextIPC(contextID, callBack){
    removeFromContextIPC(contextID, this.connection.id, function (err, success){
      if(typeof callBack === "function") callBack(err, success);
    });
  }






  //
  // Module Return Function.
  // Within this function you should set up and return your samsaara middleWare exported
  // object. Your eported object can contain:
  // name, foundation, remoteMethods, connectionInitialization, connectionClose
  //

  return function contextController(samsaaraCore){

    core = samsaaraCore;
    samsaara = samsaaraCore.samsaara;
    connectionController = samsaaraCore.connectionController;
    communication = samsaaraCore.communication;
    ipc = samsaaraCore.ipc;
    connections = connectionController.connections;

    interProcess = samsaaraCore.capability.ipc;

    samsaaraCore.addClientFileRoute("samsaara-contexts.js", __dirname + '/client/samsaara-contexts.js');

    var exported = {

      name: "contexts",

      clientScript: __dirname + '/client/samsaara-contexts.js',

      main: {
        context: context,
        isContextOpen: isContextOpen,
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

      exported.main.context = contextIPC;
      exported.main.createContext = createContextIPC;
      exported.main.isContextOpen = isContextOpenIPC;
      exported.main.removeContext = removeContextIPC;
      exported.main.addToContext = addToContextIPC;
      exported.main.removeFromContext = removeFromContextIPC;

      exported.messageRoutes.CTX = routeIPC;

      exported.remoteMethods.joinContext = joinContextIPC;
      exported.remoteMethods.leaveContext = leaveContextIPC;

      samsaara.nameSpace("interprocess").expose({
        removeContext: removeContextIPC,
        addToContext: addToContextIPC,
        removeFromContext: removeFromContextIPC
      });

      ipc.use({
        symbolicConnectionInitialization: symbolicConnectionInitialization,
        symbolicConnectionClosing: symbolicConnectionClosing
      });

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

    Context = require('./context').initialize(samsaaraCore, contexts, exported.main);

    exported.constructors.Context = Context;


    return exported;

  };

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


module.exports = exports = contextController;
