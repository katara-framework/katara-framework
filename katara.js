/*jslint es5: true, devel: true, debug: true, regexp: true, maxerr: 150, indent: 2, white: true, rhino: true, plusplus: true */
"use strict";

function p(str) {
  // in browser
  if (typeof(console) !== 'undefined') { console.log(str); }

  // in cli
  else if (typeof(print) === 'undefined') { console.log(str); }
  else { print(str); }
  
}

function pj(str, obj) {
  p(str + JSON.stringify(obj, undefined, 2));
}


var debug = false;

var g_ast = null;
var g_keywords = null;

var codestring = '\
PROGRAM\n\
   DECLARATION\n\
      NUMBER Alter 0\n\
      NUMBER Anzahl 0\n\
      NUMBER Gesamtalter 0\n\
      NUMBER Durchschnittsalter 0\n\
   ENDDECLARATION\n\
   WRITE "Alter: "\n\
   READ Alter\n\
   WHILE Alter <> 0 DO\n\
      Gesamtalter : Gesamtalter + Alter\n\
      Anzahl : Anzahl + 1\n\
      WRITE "Alter: "\n\
      READ Alter\n\
   ENDWHILE\n\
   Durchschnittsalter : Gesamtalter / Anzahl\n\
   WRITE "Durchschnittsalter = "\n\
   WRITE Durchschnittsalter \n\
ENDPROGRAM\n\
';

// NOTE/FIXME:
// order does matter: assign-statemet -> identifier will match keyword "WRITE" (from write-statement) eg
//
// statement = ( assign-statement | write-statement | read-statement | while-statement );\n\

var ebnf_string = '\
program = "PROGRAM", declaration, { statement }, "ENDPROGRAM";\n\
declaration = "DECLARATION", { vardeclaration }, "ENDDECLARATION";\n\
vardeclaration = "NUMBER", identifier, numberconstant;\n\
statement = ( write-statement | read-statement | while-statement | assign-statement );\n\
assign-statement = identifier, ":", expression;\n\
expression = ( identifier | numberconstant ), operator, ( identifier | numberconstant );\n\
operator = ( "+" | "-" | "*" | "/" );\n\
write-statement = "WRITE", ( identifier | stringconstant );\n\
read-statement = "READ", identifier;\n\
while-statement = "WHILE", log-expression, "DO", { statement }, "ENDWHILE";\n\
log-expression = ( identifier | numberconstant ), log-operator, ( identifier | numberconstant );\n\
log-operator = ( "==" | "<>" | ">" | "<" );\n\
\n\
identifier = _regex(^[a-zA-Z][a-zA-Z0-9]*);\n\
numberconstant = _regex(^[0-9][0-9]*);\n\
stringconstant = _regex(^\\".*?\\");\n\
';


/* GenericLexer {{{ */

function GenericLexer(inputstring) {
  this.inputstring = inputstring;
  this.inputleft = inputstring;
  this.inputdone = "";
  this.tokens = [];
  this.curtoken = 0;
  this.curline = 1;
  this.status = null;
  this.langdef = {
    'IDENTIFIER':       /^[a-zA-Z\-]+/,
    'TERMINAL':         /^\".*?\"/,
    'DEFINE':           /^=/,
    'CONCAT':           /^,/,
    'ALTERNATE':        /^\|/,
    'GROUP_START':      /^\(/,
    'GROUP_END':        /^\)/,
    'REPETITION_START': /^\{/,
    'REPETITION_END':   /^\}/,
    'TERMINATION':      /^;/,
    
    'REGEX':            /^_regex\(.*?\)/,

    'WHITESPACE':       /^( |\t)/,
    'NEWLINE':          /^\n/
  };

  this.frontEndMessage = [];
  this.p(this.inputstring);
}

// RETURNS
//  0 = found token
// -1 = not found -> error
//  1 = found whitespace -> do nothing
//  2 = EOF
GenericLexer.prototype.matchtoken = function (rule, rule_regex) {
  var match = this.inputleft.match(rule_regex);

  // found a match
  if (match !== null) {
    // remove the matched rule from the input
    this.inputdone += match[0];
    this.inputleft = this.inputleft.slice(match[0].length);
    if (this.inputleft.length === 0) {
      return 2;
    }

    // do nothing with whitespaces
    if (rule === 'WHITESPACE') { 
      return 1; 
    } 

    if (rule === 'NEWLINE') { 
      this.curline++;
      return 1; 
    } 

    this.tokens.push({type: rule, value: match[0], line: this.curline});
    this.p(rule + " \t\t -> " + match[0]);
    
    return 0;
  } 
  return -1; 
};

GenericLexer.prototype.eof = function() {
  if (this.inputleft.length > 0) { 
    return false;
  }
  return true;
};

GenericLexer.prototype.processNext = function() {
  var foundtoken = false,
      rule = null,
      rule_regex = null;
  
  for (rule in this.langdef) {
    rule_regex = this.langdef[rule];
    foundtoken = this.matchtoken(rule, rule_regex);
    if (foundtoken === 0) { 
      this.status = 1;
      return 1; 
    } 
    if (foundtoken === 1) {
      this.status = 2;
      return 2;
    }
    if (foundtoken === 2) {
      this.status = 3;
      return 3;
    }
  }

  this.p("[ERR] unknown/invalid token in line: " + this.curline + " at: " + this.inputleft.slice(0, 10));
  this.status = -1;
  return -1;
};

GenericLexer.prototype.tokensleft = function() {
  return this.curtoken < this.tokens.length;
};

GenericLexer.prototype.gettoken = function() {
  return this.tokens[this.curtoken++];
};

GenericLexer.prototype.ungettoken = function() {
  this.curtoken--;
};

GenericLexer.prototype.ungetAllTokens = function() {
  this.curtoken = 0;
};

GenericLexer.prototype.peektoken = function() {
  return this.tokens[this.curtoken + 1];
};

GenericLexer.prototype.setFrontendMessage = function (msg) {
  this.frontEndMessage.push(msg);
};

GenericLexer.prototype.getFrontendMessage = function() {
  return this.frontEndMessage.join('<br>');
};

GenericLexer.prototype.getLastFrontendMessage = function() {
  return this.frontEndMessage[this.frontEndMessage.length - 1] + "<br>";
};

GenericLexer.prototype.showall = function() {
  var t = this.curtoken,
      s = [];

  while(this.tokensleft() > 0) {
    s.push(this.gettoken());
  }
  this.curtoken = t;
  return s;
};

GenericLexer.prototype.getall = function() {
  while(this.tokensleft() > 0) {
    pj("", this.gettoken());
  }
};

GenericLexer.prototype.p = function (string) {
  if (debug) { p(string); }
  this.setFrontendMessage(string);
};

GenericLexer.prototype.finishUp = function() {
  this.status = 0;
}

/* }}} */

// merge nested arrays into flat array, remove dups
function arrAdd(baseArray, newArray) {
  var i = null;

  newArray = Array.prototype.concat.apply([], newArray);
  for (i in newArray) {
    if (baseArray.indexOf(newArray[i]) < 0) {
      baseArray.push(newArray[i]);
    }
  }
  return baseArray;
}

function Terminal(t) {
  if (t.indexOf("_regex") === 0) {
    this.name = t;
  } else {
    this.name = t.replace(/"/g, "");
  }

  this.first = [this.name];
  this.type = this.constructor.name;
}

Terminal.prototype.getFirst = function() {
  return this.first;
};

Terminal.prototype.exec = function(t) {
  if (this.name.indexOf("_regex") === 0) {
    // setup regex from '_regex(...)'
    var re = new RegExp(this.name.slice(7, this.name.length-1));
    if (g_keywords.indexOf(t.value) >= 0) {
      p("keyword VS regex"); //FIXME: improve
      return false;
    }
    return t.value.match(re);
  } else {
    return this.name === t.value;
  }
};

function NonTerminal(t) {
  this.name = t;
  this.first = [];
  this.type = this.constructor.name;
}

NonTerminal.prototype.getFirst = function() {
  this.first = g_ast[this.name][0].getFirst();
  return this.first;
};

NonTerminal.prototype.exec = function(t) {
  p("NT stub");
  return 0;
};

function NTAlt(t) {
  this.name = t;
  this.first = [];
  this.type = this.constructor.name;
}

NTAlt.prototype.getFirst = function() {
  var i = null;

  for (i in g_ast[this.name]) {
    this.first = arrAdd(this.first, g_ast[this.name][i].getFirst());
  }
  return this.first;
};

NTAlt.prototype.exec = function(t) {
  var i = null,
      re = null;

  if (this.first.indexOf(t.value) >= 0) {
    return true;
  }

  for (i in this.first) {
    if (this.first[i].indexOf("_regex") === 0) {
      re = new RegExp(this.name.slice(7, this.name.length-1)); 
      if ((t.value.match(re) >= 0) && (g_keywords.indexOf(t.value) < 0)) {
        return true;
      }
    }
  }

  return false;
};

function NTRep(t) {
  this.name = t;
  this.first = [];
  this.type = this.constructor.name;
}

NTRep.prototype.getFirst = function() {
  var i = null;

  for (i in g_ast[this.name]) {
    this.first = arrAdd(this.first, g_ast[this.name][i].getFirst());
  }
  return this.first;
};

NTRep.prototype.exec = function(t) {
  var i = null,
      re = null;

  if (this.first.indexOf(t.value) >= 0) {
    return true;
  }

  for (i in this.first) {
    if (this.first[i].indexOf("_regex") === 0) {
      re = new RegExp(this.name.slice(7, this.name.length-1)); 
      if ((t.value.match(re) >= 0) && (g_keywords.indexOf(t.value) < 0)) {
        return true;
      }
    }
  }
  return false;
};

/* EbnfParser {{{ */

function EbnfParser(lexer) {
  this.lexer = lexer;
  this.expectstack = [];
  this.SYNTAX = null;
  this.codestack = [];
  this.idd = [];
  this.freshrule = false;
  this.rules = [];
  this.terminals = [];
  this.ast = {};
  this.currule = null;
  this.currulest = [];
  this.NTr = 0;
  this.NTa = 0;
  this.keywords = [];
  this.langdef = {};
  this.status = null;

  this.frontEndMessage = [];

  if (!lexer) {
    this.p("[ERR] need valid lexer object as parameter");
    this.status = -1;
    return -1;
  }
}

// ----- helper 
function arrLast(a) {
  return a[a.length - 1];
}
// -----

EbnfParser.prototype.processFirst = function() {
  var token = this.lexer.gettoken();

  if (token.type === "IDENTIFIER") {
    this.p("[OK] " + token.type + " -> " + token.value);

    this.SYNTAX = token.value;
    this.expectstack.push(['_EOF'], ['TERMINATION'], ['DEFINE']);
    this.codestack.push(token);
    this.idd = [];

    this.ast['START'] = [new NonTerminal(token.value)];

    this.currule = token.value;
    this.ast[this.currule] = [];
    
    return 0;
  }

  this.p("excepted IDENTIFIER as startsymbol");
  this.status = -1;
  return -1;
};

EbnfParser.prototype.combineExpected = function(a, b) {
  var expected = this.expectstack.pop();
  if (expected == a[0]) { // BUG? FIXME
    this.expectstack.push([a[0], b[0]]);
  } else {
    this.expectstack.push(expected);
  }
};



EbnfParser.prototype.processNext = function() {
  var token = this.lexer.gettoken(),
      expected = this.expectstack.pop();

  if (expected.indexOf(token.type) >= 0) {
    if ((expected.indexOf('TERMINATION') >= 0) && (expected.length > 1) && (token.type !== 'TERMINATION')) { this.expectstack.push(['TERMINATION']); }
    if ((expected.indexOf('_EOF') >= 0) && (expected.length > 1) && (token.type !== '_EOF')) { this.expectstack.push(['_EOF']); }

    this.p("[OK] " + token.type + " -> " + token.value);
//    this.p(this.currule);
    this.status = 0;

    // new rule
    if ((token.type === "IDENTIFIER") && (this.freshrule === true)) {
      this.rules.push(token.value);
      this.expectstack.push(['TERMINATION'], ['DEFINE']);
      this.freshrule = false;
      this.codestack.push(token);
      this.idd = [];

      this.ast[token.value] = [];
      this.currule = token.value;

      return 0;
    }

    if (token.type === "DEFINE") {
      this.expectstack.push(['TERMINAL', 'IDENTIFIER', 'GROUP_START', 'REPETITION_START', 'REGEX']);
      this.idd.push(token);
      return 0;
    }

    if ((token.type === "TERMINAL") || (token.type === "IDENTIFIER")) {
      this.combineExpected(['TERMINATION'], ['CONCAT']);
      this.idd.push(token);
      this.terminals.push(token);

      if (token.type === "TERMINAL") {
        this.ast[this.currule].push(new Terminal(token.value));
        this.keywords.push(token.value.replace(/"/g, ""));
      }

      // FIXME regel vs. variable
      if (token.type === "IDENTIFIER") {
        this.ast[this.currule].push(new NonTerminal(token.value));
      }

      return 0;
    }

    if (token.type === "CONCAT") {
      this.expectstack.push(['TERMINAL', 'IDENTIFIER', 'GROUP_START', 'REPETITION_START']);
      this.idd.push(token);

      return 0;
    }

    if (token.type === "TERMINATION") {
      this.freshrule = true;
      this.combineExpected(['_EOF'], ['IDENTIFIER']);
      this.codestack[this.codestack.length - 1].idd = this.idd;

      return 0;
    }

    if (token.type === "REPETITION_START") {
      this.expectstack.push(['REPETITION_END'], ['TERMINAL', 'IDENTIFIER', 'GROUP_START', 'REPETITION_START']);
      this.idd.push(token);
    
      this.ast[this.currule].push(new NTRep("NTr_" + this.NTr));
      this.currulest.push(this.currule);
      this.currule = "NTr_" + this.NTr;
      this.ast[this.currule] = [];
      this.NTr++;

      return 0;
    }

    if (token.type === "REPETITION_END") {
      this.combineExpected(['TERMINATION'], ['CONCAT']);
      this.idd.push(token);
     
      this.currule = this.currulest.pop();
      
      return 0;
    }

    if (token.type === "GROUP_START") {
      this.expectstack.push(['GROUP_END', 'ALTERNATE'], ['TERMINAL', 'IDENTIFIER']);
      this.idd.push(token);
      
      this.ast[this.currule].push(new NTAlt("NTa_" + this.NTa));
      this.currulest.push(this.currule);
      this.currule = "NTa_" + this.NTa;
      this.ast[this.currule] = [];

      this.NTa++;
      
      return 0;
    }

    if (token.type === "ALTERNATE") {
      this.expectstack.push(['GROUP_END', 'ALTERNATE'], ['TERMINAL', 'IDENTIFIER']);
      this.idd.push(token);
      
      return 0;
    }

    if (token.type === "GROUP_END") {
      this.combineExpected(['TERMINATION'], ['CONCAT']);
      this.idd.push(token);

      this.currule = this.currulest.pop();
      
      return 0;
    }

    if (token.type === "REGEX") {
      this.idd.push(token);
      token.extra = this.rules[this.rules.length - 1];
      this.terminals.push(token);
        
      this.ast[this.currule].push(new Terminal(token.value));
      
      return 0;
    }

  } else {
    this.p("[ERR] in line " + token.line + ": expected '" + expected + "' but got '" + token.type +"'");
    this.errorline = token.line;
    this.status = -1;
    return -1;
  }
};

EbnfParser.prototype.eof = function() {
  if (this.lexer.tokensleft() > 0) { return false; }
  this.status = -2;
  return true;
};


EbnfParser.prototype.updateAST = function() {
  g_ast = this.ast;
}

// TODO rename me
EbnfParser.prototype.finished = function() {
  var r = null,
      rules = [],
      definitions = [],
      rs = null,
      i, j = null;

  // gather all rules
  for (r in this.codestack) {
    rules.push(this.codestack[r].value);
  }
  //FIXME this.codestack[r] contains line numbers
  //need them for WRN


  // check if definiton was defined (is a first class rule)
  for (r in this.codestack) {
    for (rs in this.codestack[r].idd) {
      if (this.codestack[r].idd[rs].type === "IDENTIFIER") {
//        p("\t" + this.codestack[r].idd[rs].type + " -> " + this.codestack[r].idd[rs].value);
        if (rules.indexOf(this.codestack[r].idd[rs].value) < 0) {
          this.p("[ERR] rule " + this.codestack[r].idd[rs].value + " in line " + this.codestack[r].idd[rs].line + " was used and not definied");
          this.errorline = this.codestack[r].idd[rs].line;
          return -1;
        }
        definitions.push(this.codestack[r].idd[rs].value);
      }
    }
  }

  // check if rule was definied but never used
  for (r in rules) {
    //if (definitions.indexOf(rules[r]) < 0) {
    if ((definitions.indexOf(rules[r]) < 0) && (this.SYNTAX !== rules[r])) {
      this.p("[WRN] rule " + rules[r] + " was defined but not used");
      return 1;
    }
  }


//  pj("", this.ast);
  g_ast = this.ast;
  g_keywords = this.keywords;

  for (i in this.ast) {
    for (j in this.ast[i]) {
      // p(i + " " + this.ast[i][j] + " .getFirst()");
      this.ast[i][j].getFirst();
    }
  }

  g_ast['program'].push({value:'_EOF', name:'_EOF', type:'_EOF'});
//  g_ast['START'].push({value:'_EOF', name:'_EOF', type:'_EOF'}); // FIXME potential fix
 

//  this.ast["program"][0].getFirst();
  this.pj("AST ", this.ast);

  return 0;
};

EbnfParser.prototype.p = function (string) {
  if (debug) { p(string); } 
  this.setFrontendMessage(string);
};

EbnfParser.prototype.pj = function (string, json) {
  if (debug) { pj(string, json); } 
  this.setFrontendMessage(string + JSON.stringify(json, undefined, 2));
};

EbnfParser.prototype.setFrontendMessage = function (msg) {
  this.frontEndMessage.push(msg);
};

EbnfParser.prototype.getFrontendMessage = function() {
  return this.frontEndMessage.join('<br>');
};

EbnfParser.prototype.getLastFrontendMessage = function() {
  return this.frontEndMessage[this.frontEndMessage.length - 1] + "<br>";
};

// {{{
EbnfParser.prototype.GenerateLangdef = function() {
  var langdef = {},
      i = null,
      c = null,
      name = null;

  // FIXME careful: order does matter
  for (i in this.terminals) {
    c = this.terminals[i];
    if (c.type === "TERMINAL") {
      // strip quote from terminals
      c.value = c.value.replace(/"/g, "");
      
      name = c.value;
      switch (name) {
        case '<>': name = "OP_NE"; break;
        case '==': name = "OP_EQ";  break;
        case '+': name = "OP_PLUS"; break;
        case '-': name = "OP_MINUS"; break;
        case '*': name = "OP_MUL"; break;
        case '/': name = "OP_DIV"; break;
        case ':': name = "OP_ASSIGN"; break;
        case '>': name = "OP_GT"; break;
        case '<': name = "OP_LT"; break;
      }

      // quote RexEx chars
      // FIXME improve
      c.value = c.value.replace(/\+/, "\\+");
      c.value = c.value.replace(/\*/, "\\*");
      langdef[name] = new RegExp("^" + c.value.toLowerCase(), "i");
    }
    if (c.type === "REGEX") {
      langdef[c.extra.toUpperCase()] = new RegExp(c.value.slice(7, c.value.length-1));
    }
  }
  langdef['WHITESPACE'] = /^( |\t)/;
  langdef['NEWLINE'] = /^\n/;
  this.langdef = langdef;
  return langdef;
};

/* }}} */

/* GenericParser {{{ */

function GenericParser(generic_lexer, ebnf_parser) {
  this.generic_lexer = generic_lexer;
  this.ebnf_parser = ebnf_parser;
  this.frontEndMessage = [];
  this.frontEndMessagePos = 0;
  this.frontEndMessagePosEnd = 0; 

  this.backlog = [];

  this.stack = [g_ast['START'][0]];
  this.tok = this.generic_lexer.gettoken();

  this.cc = new CodeGen();
  this.currule = g_ast['START'][0].name;
  this.currulest = [this.currule];

  this.status = 0;
}

GenericParser.prototype.setFrontendMessage = function (msg) {
  this.frontEndMessage.push(msg);
};

GenericParser.prototype.getFrontendMessage = function() {
  return this.frontEndMessage.join('<br>');
};

GenericParser.prototype.getMoreFrontendMessage = function(until) {
  var s = [],
      i = null;

  if (typeof(until) === 'undefined') {
    for (i=this.frontEndMessagePos; i<this.frontEndMessage.length; i++) {
      s.push(this.frontEndMessage[i]);
    }
    this.backlog[this.backlog.length-1].msgPosEnd = i;
  } else {
    for (i=this.frontEndMessagePos; i<until; i++) {
      s.push(this.frontEndMessage[i]);
    }
  }

  this.frontEndMessagePos = i;
  return s.join('<br>');
};

GenericParser.prototype.getLastFrontendMessage = function() {
  return this.frontEndMessage[this.frontEndMessage.length - 1] + "<br>";
};

GenericParser.prototype.p = function (string) {
  if (debug) { p(string); }
  this.setFrontendMessage(string);
};

GenericParser.prototype.pj = function (string, json) {
  if (debug) { pj(string, json); }
  this.setFrontendMessage(string + JSON.stringify(json, undefined, 2));
};


// FIXME: semCode for "program" can't reached, because _EOF is hit before
// move _EOF to Start -> program -> _EOF?
function CodeGen() {
  this.opcodes = [];        // holds the opcodes for VM
  this.internalStack = [];  // holds the terminals for Codebinding -> _0, _1 ...
}

CodeGen.prototype.enter = function(rule) {
  p("[C] entering rule " + rule.name);

  if ("pre_" + rule.name in this) {
    this["pre_" + rule.name]();
  }
}

CodeGen.prototype.leave = function(rule) {
  p("[C] leaving rule " + rule.value);

  if (rule.value in this) {
    this[rule.value]();
  }
}

CodeGen.prototype.bindFnc = function(fnc, code) {
  try {
    this[fnc] = new Function(code);
  } catch(e) {
    if (e instanceof SyntaxError) {
      alert("syntaxerror in" + fnc);
    } else { throw e; }
  }
}

CodeGen.prototype.add = function() {
  var t = [];
  for (var i=0; i<arguments.length; i++) {
    t.push(arguments[i]);
  }
  this.opcodes.push(t);
}

// TODO 'push' is a misleading name -> rename it
CodeGen.prototype.push = function(v) {
  this.internalStack.push(v);
}

// TODO
// sometimes NT Node isn't highlighted, but productionrule is
GenericParser.prototype.previous = function() {
  if (this.backlog.length === 0) {
    this.p("no backlog");
    return -1;
  }

  var t = this.backlog.pop();
  this.stack = t.stack;
  this.frontEndMessagePos = t.msgPos;
  this.frontEndMessagePosEnd = t.msgPosEnd;
  this.cc.opcodes = t.opcodes;
  this.cc.codeGenStack = t.codeGenStack;
  this.currulest = t.currulest;

  // only unget token if processNext requested a token previously
  if (t.token) {
    // twice because, we go 2 back and load 1 into current token
    // so executing for processNext is prepared
    this.generic_lexer.ungettoken(); 
    this.generic_lexer.ungettoken();
    this.tok = this.generic_lexer.gettoken();
  }
  this.status = 0;

  this.pivot = this.stack[0];
}

GenericParser.prototype.processNext = function() {
  var i, j, res, re = null,
      temp_s = [];

  // save every state, so we can go back
  // Array.slice() is a neat trick for clone/copy an array (no deepcopy though)
  this.backlog.push({
    stack: this.stack.slice(), 
    token: false, 
    msgPos: this.frontEndMessagePos, 
    opcodes: this.cc.opcodes.slice(),
    codeGenStack: this.cc.internalStack.slice(),
    currulest: this.currulest.slice()
  });

  this.pivot = this.stack.shift();

  if ((typeof(this.pivot) === 'undefined') || (this.pivot.name === '_EOF')) {
    this.p("end of input stack");
    this.p("tokens left: " + this.generic_lexer.tokensleft());
    this.status = -2;
    return 1;
  }

  this.pj("tok: ", this.tok);
  this.pj("pivot: ", this.pivot);
  this.pj("stack: ", this.stack);
  this.p("");
  this.p("");

  if (this.pivot.type === "_NonTerminalEnd") {
    try {
      this.cc.leave(this.pivot);
    } catch (e) {} // semCode might not be defined

    this.currulest.pop();

    this.processNext();
    return;
  }

  if (this.pivot.type === "NonTerminal") {
    this.currule = this.pivot.name;
    this.currulest.push(this.currule);
    try {
      this.cc.enter(this.pivot);
    } catch (e) {} // semCode might not be defined

    // execute production, push all T and NT from production onto the stack
    temp_s = [];
    this.p("expanding rule " + this.pivot.name);
    for (i in g_ast[this.pivot.name]) {
      temp_s.push(g_ast[this.pivot.name][i]);
    }

    temp_s.push({type: '_NonTerminalEnd', value: this.pivot.name});

    temp_s = temp_s.reverse();
    for (i in temp_s) {
      this.stack.unshift(temp_s[i]);
    }

    return 0;
  }

  if (this.pivot.type === "NTRep") {
    // does FIRST match?
    res = this.pivot.exec(this.tok);
    if (res) {
      // put rule back on the stack for possible repeating
      this.stack.unshift(this.pivot);

      // execute production, push all T and NT from production onto the stack
      this.p("diving into NTRep");
      // ------
      temp_s = [];
      this.p("expanding rule " + this.pivot.name);
      for (i in g_ast[this.pivot.name]) {
        temp_s.push(g_ast[this.pivot.name][i]);
      }
      temp_s = temp_s.reverse();
      for (i in temp_s) {
        this.stack.unshift(temp_s[i]);
      }
      // ------
    } else {
      this.p("skipping NTRep");
    }

    return 0;
  }

  if (this.pivot.type === "NTAlt") {
    //FIXME
    //pj("---", this.tok);

    // does FIRST match?
    res = this.pivot.exec(this.tok);
    if (res) {
      this.p("diving into NTAlt");
      // ------
      
      // execute production, push all T and NT from production in a variable
      temp_s = [];
      this.p("expanding rule " + this.pivot.name);
      for (i in g_ast[this.pivot.name]) {
        temp_s.push(g_ast[this.pivot.name][i]);
      }
//      temp_s = temp_s.reverse();
//      pj("temp_s" , temp_s);
      // find the right path based on FIRST ...
      for (i in temp_s) {
        // ... for normal Terminals
        if (temp_s[i].first.indexOf(this.tok.value) >= 0) {
          this.stack.unshift(temp_s[i]);
          this.p("... to " + temp_s[i].name);
          return 0;
        }

        // ... for Regex Terminals
        for (j in temp_s[i].first) {
      //    pj("<<", temp_s[i].first[j]);
          if (temp_s[i].first[j].indexOf("_regex") >= 0) {
      //      pj(">>", temp_s[i].first[j].slice(7, temp_s[i].first[j].length-1));
            re = new RegExp(temp_s[i].first[j].slice(7, temp_s[i].first[j].length-1));
            if (this.tok.value.match(re)) {
              this.stack.unshift(temp_s[i]);
              this.p("... to " + temp_s[i].name);
              return 0;
            }
          }
        }
      }
      // ------
    } else {
      this.p("no alternative found");
      return -1;
    }

    return 0;
  }

  if (this.pivot.type === "Terminal") {
    res = this.pivot.exec(this.tok);
    if (res) {
      try {
        this.cc.push(this.tok);
      } catch (e) {}

      this.p("[OK]");
      this.tok = this.generic_lexer.gettoken();

      // we used up token, so mark it for backlog
      this.backlog[this.backlog.length - 1]['token'] = true;

      if (!this.tok) { return -1; }
      return 0;
    } 
  }

  this.p("got " + this.tok.value + " but expected: " + this.pivot.type + " / " + this.pivot.name);
  this.status = -1;
  return -1;
};

/* }}} */



// console app ... only for dev
if (typeof(window) === 'undefined') {

  var rval = 0;
  var ebnf_lexer = new GenericLexer(ebnf_string);
  while (true) {
    rval = ebnf_lexer.processNext();
    if (rval === -1) { break; }
    if (ebnf_lexer.eof()) { 
      ebnf_lexer.p("end of input 1");
      ebnf_lexer.tokens.push({type: '_EOF', value: '_EOF'});
      break;
    }
  }

  p("__________________________________________________");

  var rval = null;
  var ebnf_parser = new EbnfParser(ebnf_lexer);

  var res = ebnf_parser.processFirst();
  while (true) {
    if (ebnf_parser.eof() === true) {
      ebnf_parser.p("no tokens left to parse");
      ebnf_parser.GenerateLangdef();
      break; 
    } else {
      res = ebnf_parser.processNext();
      if (res < 0) {
        break;
      }
    }
  }

  if (ebnf_parser.finished() < 0) {
    ebnf_parser.p("error in finished");
  }

  p("__________________________________________________");

  var target_lexer = new GenericLexer(codestring);
  target_lexer.langdef = ebnf_parser.langdef;
  pj("", ebnf_parser.langdef);
  while (true) {
    rval = target_lexer.processNext();
    if (rval === -1) { break; }
    if (target_lexer.eof()) { 
      p("end of input");
      target_lexer.tokens.push({type: '_EOF', value: '_EOF'});
      break;
    }
  }
  
  p("__________________________________________________");

  var generic_parser = new GenericParser(target_lexer, ebnf_parser);
  while (true) {
    var res = generic_parser.processNext();
    if (res < 0) {
      p("error");
      break;
    }
    if (res > 0) {
      p("finished");
      p("---------------------");
      pj("", generic_parser.cc.stack);
      break;
    }
  }

}
