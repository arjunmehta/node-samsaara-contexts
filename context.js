/*!
 * samsaaraSocks - Context Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */



var core, 
    samsaara;

var contexts;



function initialize(samsaaraCore, contextsObj){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  contexts = contextsObj;

  if(samsaaraCore.capability.groups === true){

    Context.prototype.createGroup = function(groupName){
      samsaara.createLocalGroup(this.contextID+"_"+groupName);
      this.groups[groupName] = samsaara.groups[this.contextID+"_"+groupName];
    };

    Context.prototype.group = function(groupName){
      return this.groups[groupName];
    };
  }

  return Context;

}


function Context(contextID, resource, parentContextID){

  this.id = core.uuid + contextID;
  this.contextID = contextID;

  this.owner = core.uuid;
  this.parentContextID = parentContextID || "root" ;

  this.resource = resource;

  this.nameSpaces = {};
  this.contexts = {};

  this.count = 0;
  this.members = {};  

  if(core.capability.groups === true){
    this.groups = {};
  }

}


Context.prototype.local = true;

Context.prototype.isLocal = function(){
  return this.local;
};


Context.prototype.add = function(connection, callBack){
  if(!this.members[connection.id]){
    this.count++;
    this.members[connection.id] = true;
  }

  if(typeof callBack === "function") callBack(null, this.id);
};

Context.prototype.remove = function(connection){
  if(this.members[connection.id]){
    this.count--;
    delete this.members[connection.id];
  }

  return this;
};


Context.prototype.createContext = function(contextID, resource){

  var context = samsaara.createContext(contextID, resource, this.id);
  this.contexts[contextID] = context;

  if(interProcess === true){
    ipc.publish("CTX:NEW", contextID+":"+core.uuid);
  }

  return context;
};

Context.prototype.removeContext = function(contextID){
  this.contexts[contextID] = undefined;
  samsaara.removeContext(contextID);
};


Context.prototype.createNamespace = function(nameSpaceName, exposed){
  var ns = samsaara.createNamespace(this.contextID+"_"+nameSpaceName, exposed);
  this.nameSpaces[nameSpaceName] = ns;

  return ns;
};


Context.prototype.nameSpace = function(nameSpaceName){  
  return this.nameSpaces[nameSpaceName];
};


Context.prototype.context = function(contextID){
  return this.contexts[contextID];
};




module.exports = exports = {
  initialize: initialize,
  Context: Context
};
