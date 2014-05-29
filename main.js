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




  // Context creation and removal

  // Context IDs must be unique, globally, including subcontext
  // what happens if in IPC two people create a context with the same ID at the exact same time.

  function createContext(contextID, resource, parentContext){

    // is context already open?

    debug("Creating Context", core.uuid, contextID, resource, parentContext);

    if(contexts[contextID] === undefined){

      contexts[contextID] = new Context(contextID, resource, parentContext);

      if(interProcess === true){
        ipc.addRoute("CTX:"+contextID, "CTX:"+contextID, handleContextMessage);
        ipc.store.hset("samsaara:contextOwners", contextID, core.uuid, function (err, reply){ });  
      }

      samsaara.emit("createdContext", contexts[contextID]);

      return contexts[contextID];
    }
    else{
      return new Error("Context already exists");
    }
  }

  function removeContext(contextID){
    delete contexts[contextID];
  }

  function removeContextIPC(contextID){
    if(contexts[contextID] !== undefined){
      delete contexts[contextID];
    }
    else{
      ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
        core.process(ownerID).execute("removeContext", contextID, function (err, success){
          if(typeof callBack === "function") callBack(err, contextID, connID);
        });
      });
    }
  }

  function handleDeleteContext(channel, contextID){
    delete contexts[contextID];
  }



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
            core.process(ownerID).execute("addToContext", contextID, connection.id, callBack);
          });
        },
        remove: function(connection, callBack){
          ipc.store.hget("samsaara:contextOwners", contextID, function (err, ownerID){
            core.process(ownerID).execute("removeFromContext", contextID, connection.id, callBack);
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
    }
  }



  // remove connection from context

  function removeFromContext(contextID, connID, callBack){
    if(contexts[contextID] !== undefined){
      removeConnectionFromContext(contexts[contextID], connID);
      if(typeof callBack === "function") callBack(null, true);
    }
    else{
      core.process(contexts[contextID].owner).execute("removeFromContext", contextID, connID, callBack);
    }
  }

  function removeFromContextIPC(contextID, connID, callBack){
    if(contexts[contextID] !== undefined){
      removeConnectionFromContext(contexts[contextID], connID);
      if(typeof callBack === "function") callBack(null, contextID, connID);
    }
    else{
      if(typeof callBack === "function") callBack(new Error("Context does not exist"), contextID, connID);
    }
  }

  function removeConnectionFromContext(context, connID){
    if(context.members[connID]){
      context.count--;
      delete context.members[connID];
    }
  }



  //
  // Routing Methods including IPC handling
  //

  function route(connection, owner, headerbits, message, index){

    var contextID = headerbits.indexOf(index+1);

    if(contextID !== undefined && contexts[contextID] !== undefined){
      communication.executeFunction({connection: connection, context: contexts[contextID]}, messageObj);
    }
  }



  function routeIPC(connection, owner, headerbits, message, index){

    var contextID = headerbits.indexOf(index+1);

    if(contextID !== undefined){
      if(contexts[contextID] === undefined){
        publish("CTX:"+contextID, "FRM:"+connection.id+"::"+message);
      }
      else{
        communication.executeFunction({connection: connection, context: contexts[contextID]}, messageObj);
      }
    }
  }



  function handleContextMessage(channel, message){

    debug("Handling Context Message", core.uuid, channel, message);

    var index = message.indexOf("::");
    var senderInfo = message.substring(0, index);
    var connMessage = message.slice(2+index-message.length);

    var senderInfoSplit = senderInfo.split(":");
    var connID = senderInfoSplit[senderInfoSplit.indexOf("FRM")+1];
    var contextID = senderInfoSplit[senderInfoSplit.indexOf("CTX")+1];

    var connection = connections[connID] || {id: connID};
    var context = contexts[contextID];

    var messageObj = JSON.parse(connMessage);
    if(messageObj.ns){
      messageObj.ns = contextID + "_" + messageObj.ns;
    }

    debug("Process Message", senderInfoSplit, connID, JSON.parse(connMessage));

    communication.executeFunction({connection: connection, context: context}, messageObj);
  }




  /**
   * Connection Initialization Methods
   * Called for every new connection
   *
   * @opts: {Object} contains the connection's options
   * @connection: {SamsaaraConnection} the connection that is initializing
   * @attributes: {Attributes} The attributes of the SamsaaraConnection and its methods
   */

  function connectionInitialzation(opts, connection, attributes){

    // connection.contexts = {};

    if(opts.contexts !== undefined){
      debug("Initializing Contexts.....!!!", opts.contexts, connection.id);
      attributes.force("contexts");
      attributes.initialized(null, "contexts");
    }
  }


  function connectionClosing(connection){
    var connID = connection.id;
    var connContexts = connection.contexts;

    for(var context in connContexts){
      contexts[connContexts[context]].remove(connID);

      if(contexts[connContexts[i]].members[connID] !== undefined){
        delete contexts[connContexts[i]].members[connID];
      }
    }
  }



  function SymbolicConnectionInitialization(symbolicConnection){
    symbolicConnection.contexts = {};
  }


  function SymbolicConnectionClosing(symbolicConnection){
    var connID = symbolicConnection.id;
    var connContexts = symbolicConnection.contexts;

    for(var context in connContexts){
      contexts[connContexts[context]].remove(connID);

      if(contexts[connContexts[i]].members[connID] !== undefined){
        delete contexts[connContexts[i]].members[connID];
      }
    }
  }




  /**
   * Module Return Function.
   * Within this function you should set up and return your samsaara middleWare exported
   * object. Your eported object can contain:
   * name, foundation, remoteMethods, connectionInitialization, connectionClose
   */

  return function contextController(samsaaraCore){

    core = samsaaraCore;
    samsaara = samsaaraCore.samsaara;
    connectionController = samsaaraCore.connectionController;
    communication = samsaaraCore.communication;
    ipc = samsaaraCore.ipc;

    interProcess = samsaaraCore.capability.ipc;

    Context = require('./context').initialize(samsaaraCore, contexts);

    if(interProcess === true){
      samsaara.nameSpace("interprocess").expose({
        removeContext: removeContextIPC,
        addToContext: addToContextIPC,
        removeFromContext: removeFromContextIPC
      });
    }

    var exported = {

      name: "contexts",

      main: {
        context: context,
        createContext: createContext,        
        addToContext: addToContext,
        removeFromContext: removeFromContext,
        contexts: contexts
      },

      remoteMethods: {
      },

      messageRoutes: {
        CTX: route
      },

      connectionInitialization: {
        contexts: connectionInitialzation
      },

      connectionClose: {
        contexts: connectionClosing
      },

      constructors: {
        Context: Context
      }

    };

    if(interProcess === true){
      exported.main.context = contextIPC;
      exported.main.removeContext = removeContextIPC;
      exported.main.addToContext = addToContextIPC;
      exported.main.removeFromContext = removeFromContextIPC;

      exported.messageRoutes.CTX = routeIPC;
    }

    return exported;

  };

}

module.exports = exports = contextController;
