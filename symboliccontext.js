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

function SymbolicContext(contextID, owner){
  this.id = contextID;
  this.contextID = contextID;
  this.owner = owner; 
}

SymbolicContext.prototype.local = false;

SymbolicContext.prototype.isLocal = function(){
  return this.local;
};

SymbolicContext.prototype.add = function(connection, callBack){
  core.process(this.owner).execute("addToContext", this.id, connection.id, callBack);
};

module.exports = exports = {
  initialize: initialize,
  SymbolicContext: SymbolicContext
};


// client side
// context(contextID).add(function (err, contextProcessUuid){
//
// });