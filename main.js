/*!
 * Samsaara Groups Module
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:contexts');


const LOCAL_CONTEXT = 1;
const FOREIGN_CONTEXT = 2;




function contextController(options){

  var core,
      config,
      connectionController,      
      communication,
      ipc;

  var connections;

  var interProcess;

  var contexts = {};
  var Context;


  samsaara.nameSpace("interprocess").expose({addToContext: addToContext});


  function createContext(contextID, resource, parentContext){
    if(contexts[contextID] === undefined){
      contexts[contextID] = new Context(contextID, resource, parentContext);
      if(interProcess === true){
        ipc.publish("CTX:NEW", contextID+":"+core.uuid);
      }
    }

    return contexts[contextID];
  }

  function removeContext(contextID){
    contexts[contextID] = undefined;
    if(interProcess === true){
      ipc.publish("CTX:DEL", contextID+":"+core.uuid);
    }
  }


  function context(contextID){
    return contexts[contextID];
  }


  /*
  Routing Methods including IPC handling
  */

  function preRouteFilter(connection, owner, headerAttributes, newHeader, message, next){

    var index = headerAttributes.indexOf("CTX");

    if(index !== -1){
      if(contexts[contextID] !== undefined){
        communication.executeFunction({connection: connection, context: contexts[contextID]}, messageObj);
      }
    }
    else next();
  }



  function preRouteFilterIPC(connection, owner, headerAttributes, newHeader, message, next){

    var index = headerAttributes.indexOf("CTX");

    if(index !== -1){
      if(contexts[contextID] === undefined){        
        publish("CTX:"+headerAttributes[index+1]+":MSG", "FRM:"+connection.id+":CTX:"+headerAttributes[index+1]+"::"+message);
      }
      else{
        communication.executeFunction({connection: connection, context: contexts[contextID]}, messageObj);
      }
    }
    else next();
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

    debug("Process Message", senderInfoSplit, connID, JSON.parse(connMessage));

    communication.executeFunction({connection: connection, context: context}, messageObj);

  }



  function clearFromContext(connID, callBack){

    var connection = connectionController.connections[connID];
    var contextID = connection.context;

    debug("clearFromContext", core.uuid, "CLEAR CONTEXT MAIN/////////", connID);

    if(contextID !== null && contexts[contextID] !== undefined){

      var context = contexts[contextID];
      var contextGroups = context.groups;

      for(var group in contextGroups){
        removeFromMap(connID, contextGroups[group]);
      }

      samsaara.emit("removedFromContext", connection, contextID);
    }

    connection.context = null;
    connection.foreignContext = null;

    if(typeof callBack === "function") callBack(connID);

  }




  function isContextOpen(contextID, callBack){

    var context = contexts[contextID];

    if(context === undefined){

      if(config.interProcess === true){
        // debug("CHECKING REDIS STORE IF CONTEXT IS OPEN");
        config.redisClient.hexists("openContexts", contextID, function (err, reply) {
          // debug("REDIS REPLY", err, reply);
          if(reply == "1"){
            if(typeof callBack === "function") callBack(true, false);
          }
          else{
            if(typeof callBack === "function") callBack(false, false);
          }
        });
      }
      else{
         if(typeof callBack === "function") callBack(false, false);
      }
    }
    else{
      if(typeof callBack === "function") callBack(true, true);
    }
  }


  function linkContext(contextID, toLinkTo, callBack){
    contexts[contextID] = toLinkTo;
    if(typeof callBack === "function") callBack(toLinkTo);
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

    connection.contexts = {};

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


  /**
   * Module Return Function.
   * Within this function you should set up and return your samsaara middleWare exported
   * object. Your eported object can contain:
   * name, foundation, remoteMethods, connectionInitialization, connectionClose
   */

  return function contextController(samsaaraCore){

    connectionController = samsaaraCore.connectionController;
    communication = samsaaraCore.communication;
    ipc = samsaaraCore.ipc;    

    Context = require('./context').initialize(samsaaraCore, contexts);

    var exported = {

      name: "contexts",

      foundationMethods: {
        openContextWithData: openContextWithData,
        openContext: openContext,
        createContext: createContext,
        switchContext: switchContext,
        isContextOpen: isContextOpen,
        linkContext: linkContext,
        updateContext: updateContext,
        contexts: contexts
      },

      remoteMethods: {
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

    if(config.interProcess === true){
      exported.foundationMethods.sendToGroup = sendToGroupIPC;
    }

    return exported;

  };

}

module.exports = exports = contextController;
