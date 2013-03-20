function Node(canvas, text, type, altOf) {
  this.canvas = canvas;
  this.text = text;
  this.type = type;
  this.elements = [];

  if (typeof("altOf") !== "undefined") {
    this.altOf = altOf;
  } else {
    this.altOf = null;
  }

  this.x = 10;
  this.y = 30;
  this.bb = null;


  switch (type) {
    case 'Prod':        this.color = '#ffeb99'; 
                        this.r = 15; 
                        break;

    case 'Terminal':    this.color = '#ffcc00';
                        this.r = 0;
                        break;

    case 'NonTerminal': this.color = '#aacc00';
                        this.r = 0;
                        break;

    case 'NTAlt':       this.color = '#ff00cc';
                        this.r = 0;
                        break;

    case 'NTRep':       this.color = '#ff66cc';
                        this.r = 0;
                        break;
  }

  this.create();
}

Node.prototype.create = function() {
  var margin = 5;
  var text = this.canvas.text(this.x, this.y, this.text).attr({'font-size': 14, 'text-anchor': 'start'});
  var bb = text.getBBox();
  var rect = this.canvas.rect(bb.x -margin, bb.y -margin, bb.width +margin*2, bb.height +margin*2, this.r);
  rect.attr('fill', this.color);
  rect.toBack();

  if (this.type === "Prod") {
    rect.node.id = "graph_Prod_" + this.text;
  } else {
    rect.node.id = "graph_" + this.text;
  }

  this.bb = rect.getBBox();
  this.elements.push(text, rect);
}

Node.prototype.move = function(coords) {
  if (typeof(coords) !== "undefined") {
    for (var e in this.elements) {
      this.elements[e].transform("...T" + coords.x + "," + coords.y);
    }
  } else {
    for (var e in this.elements) {
      this.elements[e].transform("...T150,0");
    }
  }

  // FIXME rect is not always the last one
  this.bb = this.elements[1].getBBox();
  if (this.bb.y2 > 80) {
    this.canvas.setSize(900, this.bb.y2 + 10);
  }
}

function Graph(canvas, name) {
  this.canvas = canvas;  
  this.name = name;
  this.elements = [];
}

Graph.prototype.addAltNode = function(text, type) {
  var alt_elements = [];
  var offset = 0;
  var bb = null;
  var first = true;
  var oldText = text;
  for (var i in g_ast[oldText]) {
    type = g_ast[oldText][i].type;
    text = g_ast[oldText][i].name;
    var newNode = new Node(this.canvas, text, type, oldText);
    bb = {'x': 0, 'y': offset};
    offset += 30;

    for (var e in this.elements) {
      while (Raphael.isBBoxIntersect(newNode.bb, this.elements[e].bb) === true) {
        newNode.move(); 
      }
    }
    newNode.move(bb);
    alt_elements.push(newNode);
  }

  for (var e in alt_elements) {
    this.elements.push(alt_elements[e]);
  }
}

Graph.prototype.addNode = function(text, type) {
  if (type.indexOf("NTRep") == 0) {
    // a_ast[text] might be unknow this time -> not forward declared
    try {
      text = g_ast[text][0].name;
    } catch (e) {}
  }
  if (type.indexOf("NTAlt") == 0) {
    this.addAltNode(text, type);
  } else {
    var newNode = new Node(this.canvas, text, type);

    for (var e in this.elements) {
      while (Raphael.isBBoxIntersect(newNode.bb, this.elements[e].bb) === true) {
        newNode.move();
      }
    }

    this.elements.push(newNode);
  }
}

// TODO: name lines for highlight
Graph.prototype.connectNodes = function() {
  var start_bb = null;
  var alt_bb = null;
  var bb_r = null;
  var alt_draw = [];
  for (var e in this.elements) {

    // Line for "skip next element"
    if (bb_r) {
      this.canvas.path("M"
          +parseInt(bb_r.x2) +","
          +parseInt(bb_r.y2 - bb_r.height/2)
          +"Q"
          +parseInt(this.elements[e].bb.x - (this.elements[e].bb.x + bb_r.x)/5) +","
          +parseInt(this.elements[e].bb.y2 - bb_r.y2 - 20)
          +" "
          +parseInt(this.elements[e].bb.x-7) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2)
          )
        .attr({'stroke-width': 2});
      bb_r = null;
    }

    // Line for "loop"
    if (this.elements[e].type == "NTRep") {
      bb_r = start_bb;

      this.canvas.path("M"
          +parseInt(this.elements[e].bb.x2 + 5) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2)
          +"Q"
          +parseInt(this.elements[e].bb.x2 + this.elements[e].bb.width/2) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2 + 35)
          +" "
          +parseInt(this.elements[e].bb.x + this.elements[e].bb.width/2) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2 + 35)
          )
        .attr({'stroke-width': 2}).node.id = 'lines_' + this.elements[e].text;

      this.canvas.path("M"
          +parseInt(this.elements[e].bb.x + this.elements[e].bb.width/2) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2 + 35)
          +"Q"
          +parseInt(this.elements[e].bb.x - this.elements[e].bb.width/2) +","
          +parseInt(this.elements[e].bb.y + this.elements[e].bb.height/2 + 35)
          +" "
          +parseInt(this.elements[e].bb.x - 10) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2)
          )
        .attr({'stroke-width': 2}).node.id = 'lines_' + this.elements[e].text;
    }

    if (this.elements[e].altOf) {
      if (!alt_bb) {
        alt_bb = start_bb;
        alt_draw.push(this.elements[e]);
      }
      else 
        start_bb = alt_bb;
    } else {
      for (var x in alt_draw) {
        this.canvas.path("M"
            +parseInt(alt_draw[x].bb.x2) +","
            +parseInt(alt_draw[x].bb.y2 - alt_draw[x].bb.height/2)
            +"L"+parseInt(this.elements[e].bb.x-9) +","
            +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2))
          .attr({'stroke-width': 2});
      }
      alt_bb = null;
    }


    if (start_bb) {
      this.canvas.path("M"
          +parseInt(start_bb.x2) +","
          +parseInt(start_bb.y2 - start_bb.height/2)
          +"L"+parseInt(this.elements[e].bb.x-9) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2))
        .attr({'stroke-width': 2});

      // arrow sign
      this.canvas.path("M"
          +parseInt(this.elements[e].bb.x - 7) +","
          +parseInt(this.elements[e].bb.y + 7)
          +"L"
          +parseInt(this.elements[e].bb.x - 3) +","
          +parseInt(this.elements[e].bb.y2 - this.elements[e].bb.height/2)
          +"L"
          +parseInt(this.elements[e].bb.x - 7) +","
          +parseInt(this.elements[e].bb.y2 - 7)
          +"Z"
          ).attr({'stroke-width': 4});
      
    }
    start_bb = this.elements[e].bb;
  }
}

// https://github.com/mathiasbynens/mothereff.in/tree/master/css-escapes
function escapeCSS(id) {
  var new_id = ""; 
  for (var i=0; i<id.length; i++) {
    if (/[ !"#$%&'()*+,./;<=>?@\[\\\]^`{|}~]/.test(id[i])) {
      new_id += "\\";
    }   
    new_id += id[i];
  }
  return new_id;
}

var restoreNodes = [];

function dehighlightNodes() {
  for(var i in restoreNodes) {
    $(restoreNodes[i].id).attr('fill', restoreNodes[i].color);
  }
  restoreNodes = [];
}

function highlightNode(pivot, currulest) {
  var e, t = null;
  if (typeof(pivot.name) === "undefined") return -1;
  var id = escapeCSS(pivot.name);

  dehighlightNodes();

  if (pivot.type === "NonTerminal") {
    var currule = currulest[currulest.length-2];
    e = $('#graph_Prod_' + id);
    restoreNodes.push({id: '#graph '+e.selector, color: e.attr('fill')});
    e.attr('fill', 'blue');
  } else {
    var currule = currulest[currulest.length-1];
  }
 
  var e = $('#graph #' + currule + ' #graph_' + id);
  //var t = $('#graph #graph_' + id);

  restoreNodes.push({id: e.selector, color: e.attr('fill')})
  e.attr('fill', 'blue');
  //try {
    //$('#graph').scrollTop(t.parent().offset().top);
  //catch(err) {}
}


function makeGraph(graphDiv) {
  for (var rule in g_ast) {
    if (rule.indexOf('NTr') == 0) continue;
    if (rule.indexOf('NTa') == 0) continue;

    graphDiv.remove("#"+rule);
    graphDiv.append("<div id='"+rule+"'></div>")
    var r = Raphael(rule, 900, 80);
    var g = new Graph(r, "Prod__" + rule);

    g.addNode(rule, "Prod");
    for (sub in g_ast[rule]) {
      g.addNode(g_ast[rule][sub].name, g_ast[rule][sub].type);
    }
    g.connectNodes();
  }
}


