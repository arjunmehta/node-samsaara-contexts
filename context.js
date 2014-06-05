/*!
 * samsaaraSocks - Context Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */



// hold the samsaaraCore and samsaara objects

var core, 
    samsaara;


// the list of all other contexts on this process

var contexts;
var contextController;


function initialize(samsaaraCore, contextsObj, contextControllerObj){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  contexts = contextsObj;
  contextController = contextControllerObj;

  if(core.capability.groups === true){

    Context.prototype.createGroup = function(groupName){
      samsaara.createLocalGroup(this.id+"_"+groupName);
      this.groups[groupName] = samsaara.groups[this.id+"_"+groupName];
    };

    Context.prototype.group = function(groupName){
      return this.groups[groupName];
    };
  }

  if(core.capability.resources === true){

    Context.prototype.createResource = function(resourceID, resource, autoExpose, callBack){

      samsaara.createResource(this.id+"_"+resourceID, resource, autoExpose, function(err, resource){
        if(!err){
          this.resources[this.id+"_"+resourceID].context = this;
          if(typeof callBack === "function") callBack(err, resource);          
        }
        else{
          if(typeof callBack === "function") callBack(err, resource);  
        }
      });
    };
  }


  return Context;
}


function Context(contextID, parentContextID){

  this.id = contextID;

  this.owner = core.uuid;
  this.parentContextID = parentContextID || "root" ;

  this.nameSpaces = {};
  this.nameSpaces.core = samsaara.createNamespace(contextID+"_core");
  this.contexts = {};

  this.count = 0;
  this.members = {};  

  if(core.capability.groups === true){
    this.groups = {};
  }
}


Context.prototype.resource = function(resourceName){
  return this.resources[resourceName];
};


// returns whether or not the context is local on this process or not (opposed to symboliccontext.js)

Context.prototype.local = true;


// add and remove connections
// might need to think about foreign connections a tad... you think?

Context.prototype.add = function(connection, callBack){
  // connection.contexts[this.id] = core.uuid;
  contextController.addToContext(this.id, connection.id, callBack);
};


Context.prototype.remove = function(connection, callBack){
  // connection.contexts[this.id] = undefined;
  contextController.removeFromContext(this.id, connection.id, callBack);
};


// creates a context locally

Context.prototype.createContext = function(contextID, resource){

  var context = samsaara.createContext(contextID, resource, this.id);
  this.contexts[contextID] = context;

  if(interProcess === true){
    ipc.publish("CTX:NEW", contextID+":"+core.uuid);
  }

  return context;
};


// removes this context

Context.prototype.removeContext = function(contextID){
  this.contexts[contextID] = undefined;
  samsaara.removeContext(contextID);
};


// creates a namespace on the context that holds methods accessible to clients in the context

Context.prototype.createNamespace = function(nameSpaceName, exposed){
  var ns = samsaara.createNamespace(this.id+"_"+nameSpaceName, exposed);
  this.nameSpaces[nameSpaceName] = ns;

  return ns;
};

Context.prototype.expose = function(exposed){
  this.nameSpace("core").expose(exposed);
};


// gets a local context namespace, which can be used to expose new methods on.

Context.prototype.nameSpace = function(nameSpaceName){  
  return this.nameSpaces[nameSpaceName];
};


// gets a local subcontext from this context

Context.prototype.context = function(contextID){
  return this.contexts[contextID];
};




module.exports = exports = {
  initialize: initialize,
  Context: Context
};
