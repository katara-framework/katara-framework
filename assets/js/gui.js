$(document).ready(function () {
    var graph_size_toggled = false;
		loadDefaultPreset();
		$('#EBNF_lex_code').attr('contentEditable', true);
		$('#Target_code').attr('contentEditable', true);
		$('#Target_symCode').attr('contentEditable', true);

		makeLineNumbers($('#EBNF_lex_code_ln'), $('#EBNF_lex_code'));
		$('#EBNF_lex_code').keyup(function() {
			makeLineNumbers($('#EBNF_lex_code_ln'), $('#EBNF_lex_code'));
		});
		
		makeLineNumbers($('#Target_code_ln'), $('#Target_code'));
		$('#Target_code').keyup(function() {
			makeLineNumbers($('#Target_code_ln'), $('#Target_code'));
		});
		
		$('.nav.nav-tabs li').click(function() {
			$('.nav.nav-tabs > li').removeClass('active');
			$('.toggleable').each(function() { $(this).addClass('hidden') });
			$($(this).children('a').attr('href')).removeClass('hidden');
			$(this).addClass('active');
			if($(this).children('a').attr('href') == '#Target') {
				$('#graph').html('');
				makeGraph($('#graph'));
			}
			return false;
		});
		
		$('i.clickable, i.sizeable').click(function() {
			if($(this).hasClass('clickable')) {
				$(this).parent().next().toggleClass('hidden');
			} else {
				$(this).parent().next().toggleClass('scrollable');
			}
			
			if($(this).hasClass('icon-plus-sign')) {
				$(this).removeClass('icon-plus-sign').addClass('icon-minus-sign');
			} else {
				$(this).removeClass('icon-minus-sign').addClass('icon-plus-sign');
			}
		});
	

    // HACK cloneing the objects into customizer
		$('#customizer').click(function(){
			$('#custom-target').html("");
			$('#custom-checkboxes input:checked').each(function(){
				$('#custom-target').append('<h3>'+$(this).parent().text()+'</h3>').append($($(this).val()).clone(true));
			});			
		});
		
		$('button').not('#customizer').click(function() {
      var graph_plus = $($('#TargetParser h4 i')[1]).hasClass("icon-plus-sign");
			if($('.nav.nav-tabs li.active a').attr('href') == '#Custom') {
				$('#customizer').click();
			}
      if (graph_plus) {
        $($('#TargetParser h4 i')[1]).click();
      }
		});
});

function makeLineNumbers(target, input) {
	var t_code = input.html();
	var t_count = 0;

  // count newlines, these are from presets
	for (var i in t_code) {
		if (t_code[i] == "\n") {
			t_count++;
		}
	}

  // count <br>, these are from userinput
	var t_tmp = t_code.match(/<br>/g);
  if (t_tmp) { t_count += t_tmp.length; }
	t_count += 2;
	
	target.html("");
	for (var i=1; i < t_count; i++) { 		
		target.append("<div class='ln_" + i + "'>" + i + "\n</div>");
	}
}

function highlightRow(target, row, col) {
	target.find('.ln_' + row).addClass('active');
}

function loadDefaultPreset() {
// EBNF Preset
var lex_code = 'program = "PROGRAM", declaration, { statement }, "ENDPROGRAM";\n\
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
stringconstant = _regex(^\".*?\"); \n';


// Targetcode Preset
var target_code = 'PROGRAM\n\
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
 WRITE Durchschnittsalter\n\
ENDPROGRAM\n';

// Semantic Code Preset
var target_symCode = '@pre_program(0) {\n\
  this.vars = {};\n\
  this.jumpstack = [];\n\
}@\n\
\n\
@vardeclaration(3) {\n\
  this.add("loadconst", _0.value);\n\
  this.add("store", _1.value);\n\
\n\
  this.vars[_1.value] = _0.value;\n\
}@\n\
\n\
@write-statement(2) {\n\
  if (_0.type === "IDENTIFIER") {\n\
    if (!(_0.value in this.vars)) {\n\
      alert("var " + _0.value + " unknown");\n\
      return -1;\n\
    }\n\
    this.add("load", _0.value);\n\
  } else {\n\
    this.add("loadconst", _0.value);\n\
  }\n\
  this.add("write");\n\
}@\n\
\n\
@read-statement(2) {\n\
  if (_0.type === "IDENTIFIER") {\n\
    if (!(_0.value in this.vars)) {\n\
      alert("var " + _0.value + " unknown");\n\
      return -1;\n\
    }\n\
  }\n\
  this.add("read");\n\
  this.add("store", _0.value);\n\
}@\n\
\n\
@expression(3) {\n\
  if (_0.type === "IDENTIFIER") {\n\
    this.add("load", _0.value);\n\
  } else {\n\
    this.add("loadconst", _0.value);\n\
  }\n\
\n\
  if (_2.type === "IDENTIFIER") {\n\
    this.add("load", _2.value);\n\
  } else {\n\
    this.add("loadconst", _2.value);\n\
  }\n\
\n\
  this.add("op", _1.value);\n\
}@\n\
\n\
@assign-statement(2) {\n\
  this.add("store", _1.value);\n\
}@\n\
\n\
@log-expression(3) {\n\
  if (_0.type === "IDENTIFIER") {\n\
    this.add("load", _0.value);\n\
  } else {\n\
    this.add("loadconst", _0.value);\n\
  }\n\
\n\
  if (_2.type === "IDENTIFIER") {\n\
    this.add("load", _2.value);\n\
  } else {\n\
    this.add("loadconst", _2.value);\n\
  }\n\
\n\
  this.add("log", _1.value);\n\
  this.add("je", "@FIXJUMP");\n\
  this.jumpstack.push(this.opcodes.length - 1);\n\
}@\n\
\n\
@pre_while-statement(0) {\n\
  this.jumpstack.push(this.opcodes.length);\n\
}@\n\
\n\
@while-statement(0) {\n\
  this.opcodes[this.jumpstack.pop()][1] = this.opcodes.length + 1;\n\
  this.add("jmp", this.jumpstack.pop());\n\
}@\n\
\n\
@endprogram(0) {\n\
}@;\n';
	
	
	$('#EBNF_lex_code').html(lex_code);
	$('#Target_code').html(target_code);
	$('#Target_symCode').html(target_symCode);
}
