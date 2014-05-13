/*!
 * samsaaraSocks - Context Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var config = require('../lib/config.js');

var connections = require('../lib/connectionController').connections;
var communication = require('../lib/communication');
var contexts = require('contexts');

exports = module.exports = Context;


function Context(contextID, contextData, access){
  this.contextID = contextID || null;
  this.members = {};
  this.groups = { everyone: { members:{} } };
  this.access = access || { owner: true, read: {}, write: {}, readGroups:{}, writeGroups:{} }; // new samsaara.Access(access);
  this.contextData = contextData || {};
}

Context.prototype.addConnection = function(connID){

  this.members[connID] = true;
  this.groups.everyone.members[connID] = true;

  config.emit("clearedFromContext", connections[connID], this.contextID);
};


Context.prototype.removeConnection = function(connID){

  var groups = this.groups;

  for(var group in groups){
    if(groups[group].members[connID] !== undefined){
      delete groups[group].members[connID];
    }
  }

  delete this.members[connID];

  config.emit("clearedFromContext", connections[connID], this.contextID);
};




Context.prototype.assignID = function(contextID){
  this.contextID = contextID;
};

Context.prototype.resetGroups = function(groups){
  this.groups = { everyone: {} };
  for(var group in groups){
    this.groups[group] = groups[group];
  }
};

Context.prototype.resetPermissions = function(permissions){
  this.access = { owner: true, read: {}, write: {}, readGroups:{}, writeGroups:{} };
  for(var priviledge in permissions){
    this.access[priviledge] = permissions[priviledge];
  }
};

// SendToGroup, addCustomGroup, addToGroup, addAccess

Context.prototype.sendToGroup = function(groupName, message, callBack){
  var group = this.groups[groupName];
  for(var connID in group){
    communication.sendToClient(connID, message, callBack);
  }
};

Context.prototype.addGroup = function(groupName){
  if(!this.groups[groupName]){
    this.groups[groupName] = {};
  }
};

Context.prototype.addToGroup = function(connID, groupName){
  if(this.groups[groupName]){
    this.groups[groupName][connID] = true;
  }  
};

Context.prototype.removeFromGroup = function(connID, groupName){
  if(this.groups[groupName]){
    delete this.groups[groupName][connID];
  }
};



Context.prototype.addAccess = function(userName, privilege){
  if(this.access[privilege] !== undefined){
    this.access[privilege][userName] = true;
  }
};

Context.prototype.authenticate = function(whichOne, forWhat, includeGroups){
  if(this.access[forWhat][whichOne.sessionInfo.userID] !== undefined){
    return true;
  }
  else if(includeGroups === true){
    var forWhatGroups = this.access[forWhat + "Groups"];
    var userGroups = whichOne.groups;
    for(var i = 0; i< userGroups.length; i++){
      if(forWhatGroups[userGroups[i]] !== undefined){
        return true;
      }
    }
    return false;
  }
  else{
    return false;
  }
};

Context.prototype.hasReadAccess = function(whichOne){
  return this.authenticate(whichOne, "read");
};

Context.prototype.hasWriteAccess = function(whichOne){
  return this.authenticate(whichOne, "write");
};

Context.prototype.isOwner = function(whichOne){
  if(this.access.owner === whichOne.sessionInfo.userID){
    return true;
  }
  else{
    return true;
  }  
};

