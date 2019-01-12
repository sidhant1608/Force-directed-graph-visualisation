if (/Android|mobile|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
  alert("I think you'd be much happier viewing this page on a desktop. Just a friendly heads up.");
}

const edgesPromise = d3.csv("IC-edges-file.csv");
const nodesPromise = d3.csv("IC-nodes-file.csv");
const graphPromise = Promise.all([edgesPromise, nodesPromise]);

const svg = {
  width: 650,
  height: 500,
  pad: 40,
};

const colors = {
  main: "rgb(4, 124, 104)",
  mainEm: "rgb(2, 151, 126)",
  highlight: "rgb(201, 15, 93)",
  plain: "rgb(66, 66, 66)",
  siblings: "rgb(62, 201, 25)",
  children: "rgb(196, 83, 6)",
  marriage: "rgb(32, 81, 158)"
};

const viz = d3.select("#viz");
const legend = d3.select("#legend");

let prevSliderVal = 2020;

graphPromise.then (function(d) {
  const edges = d[0];
  const rawNodes = d[1];
  const nodes = deleteExtras(rawNodes, edges);
  
  addListeners();
  createForceLayout(nodes,edges);
  
});

function createForceLayout(nodes,edges) {

  const nodeHash = {};
  nodes.forEach(node => {
    nodeHash[node.id] = node;
  });

  edges.forEach(edge => {
    edge.weight = 1;
    edge.source = nodeHash[edge.source];
    edge.target = nodeHash[edge.target];
  });

  const linkForce = d3.forceLink()
    .strength(0.1)
    .distance(10);

  const simulation = d3.forceSimulation()
    .force("charge", d3.forceManyBody().strength(-100))
    .force("x", d3.forceX(1))
    .force("y", d3.forceY(1))
    .force("center", d3.forceCenter().x(svg.width/2 - svg.pad).y(svg.height/2))
    .force("link", linkForce)
    .nodes(nodes)
    .on("tick", forceTick);
  
  simulation.force("link").links(edges);

  function appendNew(nodes, edges) {
    viz.selectAll("line.link")
      .data(edges, d => `${d.source.id}-${d.target.id}`)
      .enter()
      .append("line")
        .attr("class", "link")
        .style("stroke", colors.plain);

    const nodeEnter = viz.selectAll("g.node")
      .data(nodes, d => d.id)
      .enter()
      .append("g")
        .attr("class", "node");
    
    nodeEnter.append("text")
      .attr("dy", "1em")
      .attr("x", 5)
      .text(d => d.first_name + " " + d.last_name);
    nodeEnter.append("circle")
      .attr("r", 5)
      .style("fill", colors.main);
  }
  appendNew(nodes, edges);

  let activeNode;
  window.addEventListener("click", function(){
    if (activeNode) {
      activeNode.remove();
      refreshInfoBox();
    }
  });
  
  function addNodeClickability() {
    viz.selectAll("g.node").on("click", function(d){
      d3.event.stopPropagation(); 
    
      if (activeNode) activeNode.remove();
      
      activeNode  = viz.append("g")
        .attr("transform", "translate(" + d.x  + "," + d.y + ")");
        
      activeNode.append("rect")
        .attr("height", "1.5em")
        .attr("width", 0.6 * (d.first_name.length + d.last_name.length) + "em") 
        .style("fill", "white")
        .style("stroke", colors.plain);
      
      activeNode.append("text")
        .text(d.first_name + " " + d.last_name)
        .attr("dy", "1em")
        .attr("x", 5)
        .style("fill", colors.plain)
        .style("opacity", 1);
      activeNode.append("circle")
        .attr("r", 7)
        .style("fill", colors.mainEm);

      makeInfoBox(d);
    });
  }
  addNodeClickability();
  function forceTick() {
    d3.selectAll("line.link")
      .attr("x1", d => d.source.x)
      .attr("x2", d => d.target.x)
      .attr("y1", d => d.source.y)
      .attr("y2", d => d.target.y);
    d3.selectAll("g.node")
      .attr("transform", d => `translate(${d.x},${d.y})`);
      
  }

  const drag = d3.drag();
  drag.on("drag", dragging);
  d3.selectAll("g.node").call(drag);

  function dragging(d) {
    const e = d3.event;
    d.fx = e.x;
    d.fy = e.y;
    if (simulation.alpha() < 0.1) {
      simulation.alpha(0.1);
      simulation.restart();
    }
  }

  const dateSlider = document.getElementById("date-slider");
  dateSlider.addEventListener("change", displayCurrentDate);

  function displayCurrentDate() {
    const sliderValue = dateSlider.value;
    document.getElementById("slider-value").textContent = sliderValue;
    sliderResponse(sliderValue);
  }

  function sliderResponse(sliderValue) {
    simulation.stop();
    const oldNodes = simulation.nodes();
    const oldLinks = simulation.force("link").links();
    let newNodes = [], newLinks = []; 

    if (prevSliderVal > sliderValue) {
      newNodes = oldNodes.filter(d => d.birth_yr <= sliderValue && d.birth_yr > 0);
      newLinks = oldLinks.filter(d => newNodes.indexOf(d.source) > -1 && newNodes.indexOf(d.target) > -1);

      d3.selectAll("g.node")
        .data(newNodes, d => d.id)
        .exit()
        .transition()
          .duration(1500)
          .style("opacity", 0)
          .remove();
      
      d3.selectAll("line.link")
        .data(newLinks, d => `${d.source.id}-${d.target.id}`)
        .exit()
        .transition()
          .duration(1500)
          .style("opacity", 0)
          .remove();
      }

    else if (prevSliderVal < sliderValue) {
      nodesToPush = nodes.filter(d => d.birth_yr <= sliderValue && d.birth_yr >= prevSliderVal);
      newNodes = oldNodes;
      nodesToPush.forEach(n => newNodes.push(n)); 

      newLinks = edges.filter(function (d) { 
        return newNodes.indexOf(d.source) > -1 && newNodes.indexOf(d.target) > -1;
      });
      // appendNew(newNodes, newLinks); (lacks transition)

      viz.selectAll("line.link")
        .data(edges, d => `${d.source.id}-${d.target.id}`)
        .enter()
        .append("line")
          .attr("class", "link")
          .style("stroke", colors.plain)
          .style("opacity", 0)
        .transition()
        .duration(1500)
          .style("opacity", 0.4);

      const nodeEnter = viz.selectAll("g.node")
        .data(nodes, d => d.id)
        .enter()
        .append("g")
          .attr("class", "node");

      nodeEnter.append("circle")
          .attr("r", 5)
          .style("fill", colors.main)
          .style("opacity", 0)
        .transition()
        .duration(1500)
          .style("opacity", 1);

      nodeEnter.append("text")
          .attr("dy", "1em")
          .attr("x", 5)
          .style("opacity", 0)
          .text(d => d.first_name + " " + d.last_name)
        .transition()
        .duration(1500)
          .style("opacity", 1);

      addNodeClickability();
      if (document.getElementById("name-visibility").checked === true) {
        viz.selectAll("text").attr("visibility", "collapse");
      }
    }
    
    simulation
      .nodes(newNodes);
    simulation.force("link")
      .links(newLinks);
    simulation.alpha(0.1);
    simulation.restart();

    prevSliderVal = sliderValue;
  }
}

function deleteExtras(nodes, edges) {
  const newArray = [];
  for (let node of nodes) {
    for (let edge of edges) {
      if (node.id === edge.source || node.id === edge.target) {
        newArray.push(node);
        break;
      }
    }
  }
  return newArray;
}


function makeInfoBox(d) {
  refreshInfoBox();
  const infobox = d3.select("#infobox");

  infobox.append("p")
      .text("name: ")
    .append("em")
      .text(`${d.first_name} ${d.last_name}`);
  if (d.profession !== "") {
    infobox.append("p")
        .text("profession: ")
      .append("em")
        .text(d.profession);
  }
  if (d.birth_yr > 0) {
    infobox.append("p")
        .text("birth year: ")
      .append("em").
        text(d.birth_yr);
  }
  if (d.death_yr > 0) {
    infobox.append("p")
        .text("death year: ")
      .append("em")
        .text(d.death_yr);
  }
    if(d.wiki !== "")
    {    
    link = d.wiki
    infobox.append("img")
        .attr('src',"https://image.flaticon.com/icons/svg/48/48930.svg")
        .attr("height",20)
        .on("click", function(d) {window.open(link, "_blank") })}
    
    infobox.append("a")
        .text("                       ")
        
    x = "https://google.com/search?q=" + d.first_name + "+" + d.last_name + "&tbm=isch"
    infobox.append("img")
        .attr('src',"https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/1024px-Google_%22G%22_Logo.svg.png")
        .attr("height",20)
        .on("click", function(d) {window.open(x, "_blank") })
}


function refreshInfoBox() {
  d3.select("#infobox").selectAll("p").remove();
  d3.select("#infobox").selectAll("img").remove();
}

function showHideNames() {
  if (this.checked === true) 
    viz.selectAll("text").attr("visibility", "collapse");
  else viz.selectAll("text").attr("visibility", "visible");
} 

function showHideRelations() {
  if (this.checked === true) {
    d3.select("#legend-heading").attr("style","visibility:visible");
    showHideMenu("hide");
    viz.selectAll("line")
      .style("stroke-width", 1.5)
      .style("opacity", 1)
      .style("stroke", function(d) {
        if (d.relation === "marriage") return colors.marriage;
        else if (d.relation === "sibling") return colors.siblings;
        else if (d.relation === "parent-child") return colors.children;
        else console.log("error in line-relation data join");
      })
      .style("stroke-dasharray", function(d) {
        if(d.relation === "marriage") return "5 2 2";
        else if(d.relation === "parent-child") return "4 4";
      });
    
    const varArray = [["5 2 2", "4 4", "none"], [colors.marriage, colors.children, colors.siblings], ["marriage", "parent-child", "siblings"]];
    
    for (i=0;i<3;i++) {
      legend.append("line")
        .attr("x1", 5)
        .attr("x2", 40)
        .attr("y1", 30*i + 15)
        .attr("y2", 30*i + 15)
        .style("stroke-dasharray", varArray[0][i])
        .style("stroke-width", 2)
        .style("stroke", varArray[1][i]);
      legend.append("text")
        .attr("x", 50)
        .attr("y", 30*i + 20)
        .style("fill", colors.plain)
        .text(varArray[2][i]);
    }
  }
  
  else {
    viz.selectAll("line")
      .style("stroke-width", 1)
      .style("opacity", 0.4)
      .style("stroke", colors.plain)
      .style("stroke-dasharray", "none");
    legend.selectAll("line").remove();
    legend.selectAll("text").remove();
    d3.select("#legend-heading").attr("style", "visibility:hidden");
  }
}

function showHideMenu(param) {
  let el = document.getElementById("profession-listener").firstChild;
  if (el.textContent === "[+] " && param !== "hide") {
    el.textContent = "[-] ";
    document.getElementById("professions-menu").setAttribute("style", "display:block");
  }
  else {
    el.textContent = "[+] ";
    document.getElementById("professions-menu").setAttribute("style", "display:none");
    d3.selectAll("circle").style("fill", colors.main);
    for (let each of document.getElementsByClassName("professions"))
      each.checked = false;
  }
  if (document.getElementById("relations-visibility").checked === true && param !== "hide") {
    document.getElementById("relations-visibility").checked = false;
    showHideRelations();
  }
}

function showHideJobs() {
  value = this.value;
  for (let each of document.getElementsByClassName("professions")) {
    if (each.value !== value)
      each.checked = false;
  } 
  viz.selectAll("circle").style("fill", function(d) {
    if (d.profession.indexOf(value) > -1) return colors.highlight;
    else return colors.main;
  });
  if (this.checked === false)
  d3.selectAll("circle").style("fill", colors.main);
}

function addListeners() {
  document.getElementById("name-visibility").addEventListener("change", showHideNames);
  document.getElementById("relations-visibility").addEventListener("change", showHideRelations);
  document.getElementById("profession-listener").addEventListener("click", showHideMenu);
  for (i=0; i<document.getElementsByClassName("professions").length; i++) {
    document.getElementsByClassName("professions")[i].addEventListener("change", showHideJobs); //try switching to d3.selectAll and see if it loops through without need of explicit loop
  }
}