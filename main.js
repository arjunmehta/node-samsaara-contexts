/*!
 * Samsaara Groups Module
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:contexts');


const LOCAL_CONTEXT = 1;
const FOREIGN_CONTEXT = 2;


function contextController(options){

  var samsaaraCore,
      config,
      connectionController, connections,
      communication,
      ipc;

  var contexts = require('contexts');
  var Context = require('context');



  function createContext(contextID, resource){

  }




  function openContextWithData(contextID, contextData, options, callBack){
    if(typeof options === "function" && callBack === undefined){
      callBack = options;
      options = {};
    }

    isContextOpen(contextID, function (open, local){

      if(open === false){

        if(config.interProcess === true){

          contexts[contextID] = new Context(contextID, contextData, options.access);
          ipc.store.hset("openContexts", contextID, config.uuid);
          ipc.addRoute("contextMessage", "CTX:" + contextID, handleContextMessage);
          samsaaraCore.emit("openedContext", contexts[contextID]);
        }
        else{
          contexts[contextID] = new Context(contextID, contextData, options.access);
          samsaaraCore.emit("openedContext", contexts[contextID]);
        }

        if(typeof callBack === "function") callBack(null, contextID, contexts[contextID]);

      }
      else{
        if(typeof callBack === "function") callBack(new Error(contextID + " already open"), contextID, null);
      }

    });
  }

  function openContext(contextID, callBack){
    openContextWithData(contextID, {}, callBack);
  }


  // switch context doesn't exist anymore

  // addToContext
  // leaveContext

  // CTX:938ksjh:ADD



  function addToContext(connection, contextID, callBack){

    var connectionOwner = connection.owner;
    var context = contexts[contextID];

    isContextOpen(contextID, function (open, local){

      if(open === true){
         debug("addToContext", config.uuid, "CONTEXT IS OPEN");
         addLocalConnectionToLocalContext(connection, contextID, callBack);
      }
      else{
        if(typeof callBack === "function") callBack(new Error("Context Not Open"), null);
      }

    });

  }


/*

  project.expose(exported);
  What is "this" while executing context methods? Should it be the context? Or the connection?

  {connection: connection, context: context}

  this.connection.execute("hi");

  var connection = this.connection;
  var context = this.context;
  var project = this.context.contextData;

  this.context.group("clients").do("functionName").withArgs(array, [anotherarray, annother], function(){
    
  });


*/

  // function addToContextIPC(connection, contextID, callBack){

  //   var connectionOwner = connection.owner;
  //   var context = contexts[contextID];

  //   isContextOpen(contextID, function (open, local){

  //     if(open === true){
  //        debug(config.uuid, "CONTEXT IS OPEN");

  //       if(local === true){
  //         debug(config.uuid, "ATTEMPTING TO ADD TO LOCAL CONTEXT");
  //         addLocalConnectionToLocalContext(connection, contextID, callBack);
  //       }
  //       else{
  //         debug(config.uuid, "ATTEMPTING TO ADD TO FOREIGN CONTEXT");
  //         addLocalConnectionToForeignContext(connection, contextID, callBack);
  //       }
  //     }
  //     else{
  //       if(typeof callBack === "function") callBack(new Error("Context Not Open"), false);
  //     }

  //   });

  // }



  function leaveContext(contextID){
    // CTX:28uhwijhe:LV
  }

  function addLocalConnectionToLocalContext(connection, contextID, callBack){

    connection.contexts[contextID] = LOCAL_CONTEXT;
    contexts[contextID].members[connection.id] = LOCAL_CONTEXT;

    if(typeof callBack === "function") callBack(null, contextID);
    config.emit("addedToContext", connection, contexts[contextID]);
  }

  function addForeignConnectionToLocalContext(connection, contextID, callBack){

    connection.contexts[contextID] = LOCAL_CONTEXT;
    contexts[contextID].members[connection.id] = FOREIGN_CONTEXT;

    if(typeof callBack === "function") callBack(null, contextID);
    config.emit("addedToContext", connection, contexts[contextID]);    
  }



  function addLocalConnectionToForeignContext(connection, contextID, callBack){

    debug("addLocalConnectionToForeignContext", config.uuid, moduleName, contextID, callBack);

    connection.contexts[contextID] = FOREIGN_CONTEXT;

    var symbolic = {
      owner: config.uuid,
      nativeID: connection.id,
      connectionData: connection.connectionData
    };

    sendToForeignContext(contextID, symbolic, callBack);
    // this is so specific. This should be a much more general method/set of messages. createSymbolicOn(),
  }





  function sendToForeignContext(contextID, symbolic, callBack){
    ipc.publish("CTX:"+contextID+":NEW", symbolic);
  }

  function handleContextNewSymbolic(channel, symbolic){

    var symbolicData = JSON.parse(symbolic);
    var connection = connections[symbolicData.nativeID] = new Symbolic(symbolicData);

    communication.executeFunction({connection: connection, context: context}, messageObj);

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

    debug("Handling Context Message", config.uuid, channel, message);

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

    debug("clearFromContext", config.uuid, "CLEAR CONTEXT MAIN/////////", connID);

    if(contextID !== null && contexts[contextID] !== undefined){

      var context = contexts[contextID];
      var contextGroups = context.groups;

      for(var group in contextGroups){
        removeFromMap(connID, contextGroups[group]);
      }

      config.emit("removedFromContext", connection, contextID);
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

    for(var context in connection.contexts){
      contexts[connection.contexts[context]].removeConnection(connID);

      if(contexts[connection.contexts[i]].members[connID] !== undefined){
        delete contexts[connection.contexts[i]].members[connID];
      }
    }



  // if(connContext !== null && contexts[connContext] !== undefined){
  //   contexts[connContext].removeConnection(connID);
  // }

  }


  /**
   * Module Return Function.
   * Within this function you should set up and return your samsaara middleWare exported
   * object. Your eported object can contain:
   * name, foundation, remoteMethods, connectionInitialization, connectionClose
   */

  return function contextController(samsaaraCore){

    // debug(samsaaraCore,);
    config = samsaaraCore.config;
    connectionController = samsaaraCore.connectionController;
    communication = samsaaraCore.communication;
    ipc = samsaaraCore.ipc;    

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
