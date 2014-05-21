/*!
 * samsaaraSocks - SymbolicContext Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */



var core;
var samsaara;

var contexts;


function initialize(samsaaraCore, contextsObj){

  core = samsaaraCore;
  samsaara = samsaaraCore.samsaara;

  contexts = contextsObj;

  if(samsaaraCore.capability.access === true){
    SymbolicContext.prototype.hasAccess = samsaaraCore.access.hasAccess;
  }

  return SymbolicContext;

}


function SymbolicContext(contextID, parentContextID, owner){
  this.id = core.uuid + contextID;
  this.contextID = contextID;
  this.owner = owner; 
  this.parentContextID = parentContextID || "root" ;
}

// client side.


SymbolicContext.prototype.isLocal = function(){
  return false;
};

SymbolicContext.prototype.add = function(connection, callBack){
  if(connection.symbolic[this.owner])
  ipc.publish("CTX:"+this.id, "ADD::"+connection.id);
};



module.exports = exports = {
  initialize: initialize,
  SymbolicContext: SymbolicContext
};


// 
context(contextID).add(function(err, contextProcessUuid){

});