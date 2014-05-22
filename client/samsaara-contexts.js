/*!
 * Samsaara Client Context Module
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var contexts = (function(module){




  module.internalMethods = {

    getGeoPosition: function(callBack){

      if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(function (position){
          samsaara.geoposition = position;
          if(typeof callBack === "function") callBack(null, position);
        }, function (err){
          if(typeof callBack === "function") callBack(err, null);
        });
      }      
    }
  };

  module.initializationMethods = {};
  module.closeMethods = {};

  module.main = {
    context: function context(contextID){

    }
  };

  return module;

}(this.contexts = this.contexts || {}));

samsaara.use(contexts);



var samaaraContexts = function(options){

  contextDebug = debug('samsaara:contexts');

  var core,
      samsaara,
      attributes;

  var contexts = {};

  function context(contextID){
    return contexts[contextID];
  }

  function Context(contextID, ownerID){
    this.id = this.contextID = contextID;
    this.owner = ownerID;
  }

  function ContextNameSpace(){

  }

  

  Context.prototype.nameSpace = function(nameSpaceName){
    return new ContextNameSpace(nameSpaceName, this.id);
  };

  Context.prototype.execute = function(){

    var context = this;
    var packet = {context: this.id, func: arguments[0], args: []};

    for (var i = 1; i < arguments.length-1; i++){
      packet.args.push(arguments[i]);
    }

    if(typeof arguments[arguments.length-1] === "function"){
      core.makeCallBack(0, packet, arguments[arguments.length-1], function (incomingCallBack, packetReady){
        samsaara.sendRawWithHeaders( this.owner, {}, packetReady );
      });
    }
    else{
      packet.args.push(arguments[arguments.length-1]);
      samsaara.sendRawWithHeaders( this.owner, {}, JSON.stringify(packetJSON) );
    }
    
  };


  function createContext(successContextID, contextOwner){
    contexts[successContextID] = new Context(successContextID, contextOwner);
  }


  function joinContext(contextID, callBack){
    samsaara.execute("addToContext", function(err, successContextID, contextOwner){
      if(err){
        contextDebug("Add to Context Error:", err);
      }
      else{
        createContext(successContextID, contextOwner);
        samsaara.emit("addedToContext", successContextID);
        if(typeof callBack === "function") callBack(err, successContextID);
      }
    });
  }




  return function authentication(samsaaraCore, samsaaraAttributes){

    samsaara = samsaaraCore;
    attributes = samsaaraAttributes;

    attributes.force("initToken");

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
      messageHeaders: {
        TKN: samsaaraToken
      }
    };

    return exported;

  };
};

samsaara.use(samaaraAuthentication());