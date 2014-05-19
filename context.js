/*!
 * samsaaraSocks - Context Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var config = require('../lib/config.js');

var connections = require('../lib/connectionController').connections;
var communication = require('../lib/communication');
var contexts;


function initialize(samsaaraCore, contextsObj){

  contexts = contextsObj;

  if(samsaara.capability.groups === true){
    Context.prototype.createGroup = function(groupName){
      samsaara.createLocalGroup(this.contextID+"_"+groupName);
      this.groups[groupName] = samsaara.groups[this.contextID+"_"+groupName];
    };

    Context.prototype.group = function(groupName){
      return this.groups[groupName];
    };
  }

  if(samsaara.capability.access === true){
    Context.prototype.hasAccess = samsaara.access.hasAccess;
  }
}


function Context(contextID, resource){

  this.contextID = this.id = contextID;

  this.nameSpaces = {};
  this.contexts = {};

  this.count = 0;
  this.members = {};
  this.resource = resource;

  if(samsaara.capability.groups === true){
    this.groups = {};
  }

}

Context.prototype.add = function(connection){
  if(!this.members[connection.id]){
    this.count++;
    this.members[connection.id] = true;
  }
};

Context.prototype.remove = function(connection){
  if(this.members[connection.id]){
    this.count--;
    delete this.members[connection.id];
  }
};

Context.prototype.createContext = function(contextID, resource){
  samsaara.createContext(contextID, resource);
  this.contexts[contextID] = samsaara.contexts[contextID];
};

Context.prototype.createNamespace = function(nameSpaceName, exposed){
  samsaara.createNamespace(this.contextID+"_"+nameSpaceName, exposed);
  this.nameSpaces[nameSpaceName] = samsaara.nameSpaces[this.contextID+"_"+nameSpaceName];
};






module.exports = exports = {
  initialize: initialize,
  Context: Context
};
