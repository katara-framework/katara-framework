function VM(opcodes) {
  this.opcodes = opcodes;
  this.stack = [];
  this.vars = {};
  this.ip = 0;

  this.input = "vm_input";
  this.output = "vm_output";
  this.io_stack = null;
  this.io_vars = null;
  this.io_ops = null;
  this.io_status = null;

  this.io_wait = false;

  this.execute = true;
}

VM.prototype.processInput = function() {
  var val = $("#vminputbox").val();
  if (val.length === 0) {
    $(this.io_status).append("Please enter something <br>");
    return 0;
  }
  $('#vminputbox').remove();
  $('#vminputenter').remove();
  $(this.output).append(" << " + val + "<br>");

  this.io_wait = false;
  this.stack.push(val);
  this.updateIO();
}

VM.prototype.handleInput = function() {
  if ($("#vminputbox").length === 0) {
    $(this.input).append("<input id='vminputbox' type='text'>");
    $(this.input).append("<button class='btn-small' id='vminputenter' onClick='javascript:vm.processInput();'>Enter</button>");
  }
  this.io_wait = true;
}

VM.prototype.handleOutput = function(str) {
  str = String(str);
  $(this.output).append(str.replace(/\"/g, "") + "</br>");
}

VM.prototype.updateIO = function() {
  $(this.io_stack).html(this.stack.join('</br>'));

  $(this.io_vars).html("");
  for (var i in this.vars) {
    $(this.io_vars).append(i + ": " + this.vars[i] + "</br>");
  }

  $(this.io_ops).html(this.opcodes.slice(this.ip).join('</br>'));
}

VM.prototype.tick = function() {

  var p = this.opcodes[this.ip];
  if (typeof(p) === "undefined") return -1;

  switch(p[0]) {
    case "load":
                this.stack.push(this.vars[p[1]]);
                break;

    case "loadconst":
                this.stack.push(p[1]);
                break;

    case "store":
                this.vars[p[1]] = this.stack.pop();
                break;

    case "write":
                var op1 = this.stack.pop();
                this.handleOutput(op1);
                break;

    case "read":
                this.handleInput();
                break;

    case "log":
                var result = null;
                var op1 = this.stack.pop();
                var op2 = this.stack.pop();

                switch (p[1]) {
                  case '<>':  if (op1 != op2) { result = false; } else { result = true; } 
                              break;
                  default: print("implement me");
                }
                this.stack.push(result);
                break;

    case "je":
                if (this.stack.pop()) {
                  this.ip = p[1] - 1;
                }
                break;

    case "jne":
                if (!this.stack.pop()) {
                  this.ip = p[1] - 1;
                }
                break;

    case "jmp":
                this.ip = p[1] - 1;
                break;

    case "op":
                var result = null;
                var op1 = this.stack.pop();
                var op2 = this.stack.pop();

                switch (p[1]) {
                  case '/': result = Number(op1) / Number(op2); break;
                  case '+': result = Number(op1) + Number(op2); break;
                  default: print("implement me");
                }
                this.stack.push(result);
                break;
    default:
                throw "unknown opcode";
  }

  this.ip++;
  this.updateIO();
  return 0;
}

VM.prototype.next = function() {
  if (!this.io_wait) {
    this.tick();
  }
}

VM.prototype.run = function() {
  var res = this.tick();
  var that = this;

  var iid = setInterval(function() { 
    res = that.next(); 
    if (res < 0) {
      clearInterval(iid);
    }
  }, 500);
}
