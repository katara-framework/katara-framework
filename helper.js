/*jslint es5: true, devel: true, debug: true, regexp: true, maxerr: 150, indent: 2 */
"use strict";

var ebnf_lexer = null;
var ebnf_parser = null;
var target_lexer = null;
var target_parser = null;
var vm = null;

// EBNF LEXER -------------------------------------- {{{
function ebnf_lexer_reset() {
	$('#EBNF_lex_output').html('reset! <br>');
	$('#EBNF_lex_code .marker').remove();
	$('#EBNF_lex_code_ln .active').removeClass('active');
	
  var input = $('#EBNF_lex_code').text();
  ebnf_lexer = new GenericLexer(input);
}

function ebnf_lexer_run() {
  var res = null;
  while (true) {
    res = ebnf_lexer_next();
    if (res == 1) { break; }
    if (res == -1) { break; }
  }
}

function ebnf_lexer_next() {
  var res = null;
  if (!ebnf_lexer) {
    ebnf_lexer_reset();
  }
  if (ebnf_lexer.eof()) {
    $('#EBNF_lex_output').append("EOF reached ... appending _EOF to tokenlist</br>");
    ebnf_lexer.tokens.push({type: '_EOF', value: '_EOF'});
  
    // clean up cursor
    $('#EBNF_lex_code').text(ebnf_lexer.inputdone);
    $('#EBNF_lex_output').scrollTop(10000);
    return 1;
  }

  var res = ebnf_lexer.processNext();
  while (res == 2) {
    var res = ebnf_lexer.processNext();
  }
  
  $('#EBNF_lex_code').html(ebnf_lexer.inputdone + '<span class="marker">(+)</span>' + ebnf_lexer.inputleft);

  $('#EBNF_lex_output').append(res + " || " + ebnf_lexer.getLastFrontendMessage());
  $('#EBNF_lex_output').scrollTop(10000);

  // error happend
  if (res == -1) {
    highlightRow($('#EBNF_lex_code_ln'), ebnf_lexer.curline, "red");
    return -1; 
  }

  return 0;
}
// EBNF LEXER -------------------------------------- }}}


// EBNF PARSER -------------------------------------- {{{
// FIXME - not pretty
var t_first = true;

function ebnf_parser_reset() {
  if (!ebnf_lexer) {
    $('#EBNF_parser_output').append("invalid ebnflexer object, run ebnflexer first <br>");
    return -1;
  }
  ebnf_parser = new EbnfParser(ebnf_lexer);
  $('#EBNF_parser_output').html('reset! <br>');
  $('#graph').html("");
  t_first = true;
  ebnf_lexer.ungetAllTokens();
}

function ebnf_parser_next(run) {
  var res = null;

  if (!ebnf_parser) {
    res = ebnf_parser_reset();
    if (res === 0) { return res; }
  }

  if (ebnf_parser.status < 0) { return -1; }

  if (ebnf_parser.eof()) {
    ebnf_parser.p("no tokens left to parse");
    ebnf_parser.GenerateLangdef();
    $('#EBNF_parser_output').html(ebnf_parser.getFrontendMessage());
    $('#EBNF_parser_output').scrollTop(10000);
    ebnf_parser.finished();
    makeGraph($('#graph'));
    return 1;
  }

  if (t_first) {
    res = ebnf_parser.processFirst();
    t_first = false;
  } else {
    res = ebnf_parser.processNext();
    if (res < 0 ) {
      $('#EBNF_parser_output').html(ebnf_parser.getFrontendMessage());
      $('#EBNF_parser_output').scrollTop(10000);
      highlightRow($('#EBNF_lex_code_ln'), ebnf_parser.errorline, "red");
      return -1; 
    }
  }

  $('#EBNF_parser_output').html(ebnf_parser.getFrontendMessage());
  $('#EBNF_parser_output').scrollTop(10000);
  
  if (!run) {
    ebnf_parser.updateAST();
    $('#graph').html("");
    makeGraph($('#graph'));
  }

  return 0;
}

function ebnf_parser_run() {
  var res = null;

  while (true) {
    res = ebnf_parser_next(true);
    if (res !== 0) { return res; }
  }
}
// EBNF PARSER --------------------------------------- }}}



function target_lexer_reset() {
  var input = $('#Target_code').text();
  target_lexer = new GenericLexer(input);
  if (!ebnf_parser) {
    $('#Target_lex_output').html('no valid EBNF Parser Object found, run EBNF Parser first.');
    return -1;
  }
  target_lexer.langdef = ebnf_parser.langdef;
  $('#Target_lex_output').html('reset! <br>');
	$('#Target_code .marker').remove();
	$('#Target_code_ln .active').removeClass('active');
//  $('#Target_code_ln *').css('background-color', 'yellow');
}

function target_lexer_next() {
  if (!target_lexer) {
    target_lexer_reset();
  }
  if (target_lexer.eof()) {
    $('#Target_lex_output').append("EOF reached ... appending _EOF to tokenlist</br>");
    target_lexer.tokens.push({type: '_EOF', value: '_EOF'});

    $('#Target_code').text(target_lexer.inputdone);
    $('#Target_lex_output').scrollTop(10000);
    return 1;
  }

  var res = target_lexer.processNext();
  while (res == 2) {
    var res = target_lexer.processNext();
  }
  
  $('#Target_code').html(target_lexer.inputdone + '<span class="marker">(+)</span>' + target_lexer.inputleft);

  $('#Target_lex_output').append(res + " || " + target_lexer.getLastFrontendMessage());
  $('#Target_lex_output').scrollTop(10000);

  // error happend
  if (res == -1) {
    highlightRow($('#Target_code_ln'), target_lexer.curline, "red");
    return -1; 
  }

  return 0;
}

function target_lexer_run() {
  var res = null;
  while (true) {
    res = target_lexer_next();
    if (res == 1) { break; }
    if (res == -1) { break; }
  }
}


function target_parser_reset() {
  if (!target_lexer) {
    $('#Target_parser_output').append("invalid targetlexer object, run targetlexer first");
    return -1;
  }
  if (!ebnf_parser) {
    $('#Target_parser_output').append("invalid ebnfparser object, run ebnfparser first");
    return -1;
  }
  target_lexer.ungetAllTokens();
  target_parser = new GenericParser(target_lexer, ebnf_parser);

  target_bindCode();

  $('#Target_parser_output').html("reset!");
  $('#TokenStack').html("");
  highlightNode(target_parser.stack[0], target_parser.currulest);
}

function target_parser_next() {
  if (!target_parser) {
    target_parser_reset();
  }

  if (target_parser.status < 0) { return -1; } // to nothing, we hit an error
    
  $('#TokenStack').html("");
  var tt = target_lexer.showall();
  tt = tt.reverse()
  for (var i in tt) {
    $('#TokenStack').append(JSON.stringify(tt[i]) + "<br>" );
  }

  var res = target_parser.processNext();

  highlightNode(target_parser.pivot, target_parser.currulest);

  $('#Target_parser_output').html(res + " || " + target_parser.getMoreFrontendMessage());
  $('#Target_parser_output').scrollTop(10000);

  $('#Target_opcodes').html(target_parser.cc.opcodes.join("<br>"));

  if (res < 0 ) {
    $('#Target_parser_output').append("error");
    return -1;
  }
  if (res > 0 ) {
    $('#Target_parser_output').append("finished");
    return 1;
  }
  return 0;
}

function target_parser_prev() {
  var res = null;

  if (!target_parser) {
    target_parser_reset();
  }

  res = target_parser.previous();
  if (res < 0) {
    return;
  }

  $('#TokenStack').html("");
  var tt = target_lexer.showall();
  tt = tt.reverse()
  for (var i in tt) {
    $('#TokenStack').append(JSON.stringify(tt[i]) + "<br>" );
  }

  highlightNode(target_parser.pivot, target_parser.currulest);

  $('#Target_parser_output').html(res + " || " + target_parser.getMoreFrontendMessage(target_parser.frontEndMessagePosEnd));
  $('#Target_parser_output').scrollTop(10000);
  
  $('#Target_opcodes').html(target_parser.cc.opcodes.join("<br>"));
}

function target_parser_run() {
  while (true) {
    var res = target_parser_next();
    if (res != 0) { break; }
  }
}

function target_bindCode() {
  var cc = target_parser.cc;
  var code = $('#Target_symCode').text();
  /* RegExp for 
   * @nonterminal(N) { ... }@ structur
   */
  var re = new RegExp(/^[\s]*@(.*?)\((\d)\)[\s]*\{([\S\s]*?)}@/);

  var res = null;
  while (true) {
    res = code.match(re);
    if (!res) { break; }
    console.log("binding " + res[1] + " with " + res[3]);

    // prepare setup for _0, _1, ..., _N variables
    var stub = "";
    for (var i=0; i<res[2]; i++) {
      stub += "var _" + i + " = this.internalStack.pop();\n";
    }

    cc.bindFnc(res[1], stub + res[3]);

    code = code.slice(res[0].length);
  }

}

function VM_reset() {
  vm = new VM(target_parser.cc.opcodes);
  //vm = new VM(opcodes);
  vm.input = "#vm_io";
  vm.output = "#vm_io";
  vm.io_stack = "#vm_stack";
  vm.io_vars = "#vm_vars";
  vm.io_ops = "#vm_ops";
  vm.io_status = "#vm_status";

  $('#vm_status').html("reset! <br>");
  vm.updateIO();
}

function VM_next() {
  if (!vm) {
    VM_reset();
  }
  vm.next();
}

function VM_run() {
  if (!vm) {
    VM_reset();
  }
  vm.run(); 
}


function preset_saveItem() {
  var name = $('#presetname').val();
  if (localStorage.getItem("katara_" + name)) {
    $('#overwrite').css({'display' : 'inline'});
    $('#info').html(name + " already exists");
  } else {
    var data = {};

    data['EBNF_lex_code'] = $('#EBNF_lex_code').html();
    data['Target_code'] = $('#Target_code').html();
    data['Target_symCode'] = $('#Target_symCode').html();

    localStorage.setItem("katara_" + name, JSON.stringify(data));
    $('#info').html(name + " saved");
    preset_getItemList();
    $('#presetname').val("");
  }
}

function preset_overwriteItem() {
  var name = $('#presetname').val();
  var data = {};

  data['EBNF_lex_code'] = $('#EBNF_lex_code').html();
  data['Target_code'] = $('#Target_code').html();
  data['Target_symCode'] = $('#Target_symCode').html();

  localStorage.setItem("katara_" + name, JSON.stringify(data));
  $('#info').html(name + " overwritten");
  $('#presetname').val("");
}

function preset_loadItem(name) {
  var data = JSON.parse(localStorage.getItem(name));

  $('#EBNF_lex_code').html(data['EBNF_lex_code']);
  $('#Target_code').html(data['Target_code']);
  $('#Target_symCode').html(data['Target_symCode']);
  $('#info').html(name + " loaded");

	makeLineNumbers($('#EBNF_lex_code_ln'), $('#EBNF_lex_code'));
	makeLineNumbers($('#Target_code_ln'), $('#Target_code'));
}

function preset_deleteItem(name) {
  localStorage.removeItem(name);
  preset_getItemList();
  $('#info').html(name + " deleted");
}

function preset_getItemList() {
  var name = null;
  $('#list').html("");
  for (var i in localStorage) {
    if (i.indexOf("katara_") === 0) {
      name = i.slice(7);
      $('#list').append("<div>"+name+" <button class='btn-small' onClick='preset_loadItem(\""+i+"\")'>Load</button><button class='btn-small' onCLick='preset_deleteItem(\""+i+"\");'>Delete</button></div>");
    }
  }
}

$(document).ready(function() {
  preset_getItemList();
});



