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
    samsaara.nameSpace('samsaaraContextController').execute("addToContext", function(err, successContextID, contextOwner){
      if(err){
        contextDebug(new Error("Add to Context Error:", err));
      }
      else{
        createContext(successContextID, contextOwner);
        samsaara.emit("addedToContext", successContextID);
        if(typeof callBack === "function") callBack(err, successContextID);
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
        var packet = {context: context.id, ns: nameSpaceName, func: arguments[0], args: []};
        packet = core.processPacket(packet, arguments);
        core.send( packet, core.samsaaraOwner ); // should owner be "CTX" and work like routing works on client??? YES.
      }
    };
  };

  Context.prototype.execute = function(){

    var packet = {context: this.id, func: arguments[0], args: []};
    packet = core.processPacket(packet, arguments);    
    core.send( packet, core.samsaaraOwner );    
  };

  Context.prototype.leave = function(callBack){
    samsaara.nameSpace('samsaaraContextController').execute("leaveContext", callBack);
  };


  return function contexts(samsaaraCore, samsaaraAttributes){

    samsaara = samsaaraCore.samsaara;
    attributes = samsaaraAttributes;


    var exported = {
      
      internalMethods: {
        updateToken: updateToken
      },
      initializationMethods: {
        newConnectionAuthentication: newConnectionAuthentication
      },
      messageRoutes: {
        initToken: initToken
      },

    };

    return exported;

  };
};

samsaara.use(samaaraContexts());

