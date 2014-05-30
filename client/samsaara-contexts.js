/*!
 * Samsaara Client Context Module
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var samaaraContexts = function(options){

  contextDebug = debug('samsaara:contexts');

  var core,
      samsaara,
      attributes;

  var contexts = {};


  // exposed

  function context(contextID){
    return contexts[contextID];
  }

  function joinContext(contextID, callBack){
    console.log("Joining Context", contextID);
    samsaara.nameSpace('contextController').execute("joinContext", contextID, function(err, successContextID, contextOwner){
      if(err){
        contextDebug(new Error("Add to Context Error:", err));
        if(typeof callBack === "function") callBack(new Error("Add to Context Error:", err), null);
      }
      else{
        createContext(successContextID, contextOwner);
        samsaara.emit("joinedContext", contexts[successContextID]);
        if(typeof callBack === "function") callBack(err, contexts[successContextID]);
      }
    });
  }

  function leaveContext(contextID, callBack){
    samsaara.nameSpace('contextController').execute("leaveContext", contextID, function(err, successContextID){
      if(err){
        contextDebug(new Error("Remove from Context Error:", err));
        if(typeof callBack === "function") callBack(new Error("Add to Context Error:", err), null);
      }
      else{               
        samsaara.emit("leftContext", contexts[successContextID]);
        if(typeof callBack === "function") callBack(err, contexts[successContextID]);
        delete contexts[successContextID]; 
      }
    });
  }



  // private

  function createContext(successContextID, contextOwner){
    contexts[successContextID] = new Context(successContextID, contextOwner);
  }


  function Context(contextID, ownerID){
    this.id = this.contextID = contextID;
    this.owner = ownerID;
  }

  Context.prototype.nameSpace = function(nameSpaceName){

    var context = this;

    return {
      execute: function execute(){
        var packet = {ns: nameSpaceName, func: arguments[0], args: []};
        packet = core.processPacket(packet, arguments);
        core.send( packet, "CTX:"+context.id);
      }
    };
  };

  Context.prototype.execute = function(){

    var packet = {func: arguments[0], args: []};
    packet = core.processPacket(packet, arguments);
    core.send( packet, "CTX:"+this.id);
  };

  Context.prototype.leave = function(callBack){
    samsaara.nameSpace('contextController').execute("leaveContext", this.id,   callBack);
  };


  return function contexts(samsaaraCore, samsaaraAttributes){

    console.log("DOES CORE SAMSAARA EXIST?", samsaaraCore);

    core = samsaaraCore;
    samsaara = samsaaraCore.samsaara;
    attributes = samsaaraAttributes;

    var exported = {
      
      internalMethods: {   
      },
      initializationMethods: {        
      },
      messageRoutes: {        
      },
      main: {
        joinContext: joinContext,
        leaveContext: leaveContext,
        context: context
      }

    };

    return exported;

  };
};

samsaara.use(samaaraContexts());

